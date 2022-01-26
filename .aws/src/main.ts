import { Construct } from 'constructs';
import {
  App,
  DataTerraformRemoteState,
  RemoteBackend,
  TerraformStack
} from 'cdktf';
import {
  AwsProvider,
  DataAwsCallerIdentity,
  DataAwsKmsAlias,
  DataAwsRegion,
  DataAwsSnsTopic
} from '@cdktf/provider-aws';
import { config } from './config';
import {
  ApplicationMemcache,
  PocketALBApplication,
  PocketVPC,
  PocketPagerDuty, PocketECSCodePipeline
} from '@pocket-tools/terraform-modules';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty';
import { LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null';

class ClientAPI extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', { region: 'us-east-1' });
    new PagerdutyProvider(this, 'pagerduty_provider', { token: undefined });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');

    new RemoteBackend(this, {
      hostname: 'app.terraform.io',
      organization: 'Pocket',
      workspaces: [{ prefix: `${config.name}-` }]
    });

    const region = new DataAwsRegion(this, 'region');
    const caller = new DataAwsCallerIdentity(this, 'caller');

    const pocketApp = this.createPocketAlbApplication({
      pagerDuty: this.createPagerDuty(),
      secretsManagerKmsAlias: this.getSecretsManagerKmsAlias(),
      snsTopic: this.getCodeDeploySnsTopic(),
      nodeList: this.createElasticache(),
      region,
      caller
    });
    this.createApplicationCodePipeline(pocketApp);
  }


  /**
   * Get the sns topic for code deploy
   * @private
   */
  private getCodeDeploySnsTopic() {
    return new DataAwsSnsTopic(this, 'backend_notifications', {
      name: `Backend-${config.environment}-ChatBot`
    });
  }

  /**
   * Get secrets manager kms alias
   * @private
   */
  private getSecretsManagerKmsAlias() {
    return new DataAwsKmsAlias(this, 'kms_alias', {
      name: 'alias/aws/secretsmanager'
    });
  }

  /**
   * Create CodePipeline to build and deploy terraform and ecs
   * @param app
   * @private
   */
  private createApplicationCodePipeline(app: PocketALBApplication) {
    new PocketECSCodePipeline(this, 'code-pipeline', {
      prefix: config.prefix,
      source: {
        codeStarConnectionArn: config.codePipeline.githubConnectionArn,
        repository: config.codePipeline.repository,
        branchName: config.codePipeline.branch
      }
    });
  }

  /**
   * Create PagerDuty service for alerts
   * @private
   */
  private createPagerDuty(): PocketPagerDuty | undefined {
    if (config.isDev) {
      //Dont create pagerduty services for a dev service.
      return null;
    }


    const incidentManagement = new DataTerraformRemoteState(
      this,
      'incident_management',
      {
        organization: 'Pocket',
        workspaces: {
          name: 'incident-management'
        }
      }
    );

    return new PocketPagerDuty(this, 'pagerduty', {
      prefix: config.prefix,
      service: {
        criticalEscalationPolicyId: incidentManagement.get(
          'policy_backend_critical_id'
        ),
        nonCriticalEscalationPolicyId: incidentManagement.get(
          'policy_backend_non_critical_id'
        )
      }
    });
  }

  private createPocketAlbApplication(dependencies: {
    pagerDuty?: PocketPagerDuty;
    region: DataAwsRegion;
    caller: DataAwsCallerIdentity;
    secretsManagerKmsAlias: DataAwsKmsAlias;
    snsTopic: DataAwsSnsTopic;
    nodeList: string[];
  }): PocketALBApplication {
    const { pagerDuty, region, caller, secretsManagerKmsAlias, snsTopic, nodeList } =
      dependencies;

    return new PocketALBApplication(this, 'application', {
      internal: false,
      prefix: config.prefix,
      alb6CharacterPrefix: config.shortName,
      tags: config.tags,
      cdn: true,
      domain: config.domain,
      containerConfigs: [
        {
          name: 'app',
          portMappings: [{
            hostPort: 4000,
            containerPort: 4000,
            protocol: 'tcp'
          }],
          envVars: [
            {
              name: 'ENVIRONMENT',
              value: process.env.NODE_ENV // this gives us a nice lowercase production and development
            },
            {
              name: 'MEMCACHED_SERVERS',
              value: nodeList.join(','),
            },
            {
              name: 'JWT_ISSUER',
              value: config.envVars.auth.jwtIssuer
            },
            {
              name: 'KIDS',
              value: config.envVars.auth.kids
            },
            {
              name: 'DEFAULT_KID',
              value: config.envVars.auth.defaultKid
            },
            {
              name: 'APOLLO_GRAPH_REF',
              value: `${config.envVars.graph.graphId}@${config.envVars.graph.graphVariant}`
            }
          ],
          secretEnvVars: [
            {
              name: 'SENTRY_DSN',
              valueFrom: `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/SENTRY_DSN`
            },
            {
              name: 'APOLLO_KEY',
              valueFrom: `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/APOLLO_KEY`
            }
          ],
          healthCheck: {
            command: [
              'CMD-SHELL',
              'curl -f http://localhost:4000/.well-known/apollo/server-health || exit 1'
            ],
            interval: 15,
            retries: 3,
            timeout: 5,
            startPeriod: 0
          }
        },
        {
          name: 'xray-daemon',
          containerImage: 'amazon/aws-xray-daemon',
          repositoryCredentialsParam: `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared/DockerHub`,
          portMappings: [{
            hostPort: 2000,
            containerPort: 2000,
            protocol: 'udp'
          }],
          command: ['--region', 'us-east-1', '--local-mode']
        }
      ],
      codeDeploy: {
        useCodeDeploy: true,
        useCodePipeline: true,
        snsNotificationTopicArn: snsTopic.arn
      },
      exposedContainer: {
        name: 'app',
        port: 4000,
        healthCheckPath: '/.well-known/apollo/server-health'
      },
      ecsIamConfig: {
        prefix: config.prefix,
        taskExecutionRolePolicyStatements: [
          //This policy could probably go in the shared module in the future.
          {
            actions: ['secretsmanager:GetSecretValue', 'kms:Decrypt'],
            resources: [
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared`,
              `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared/*`,
              secretsManagerKmsAlias.targetKeyArn
            ],
            effect: 'Allow'
          },
          //This policy could probably go in the shared module in the future.
          {
            actions: ['ssm:GetParameter*'],
            resources: [
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}`,
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/*`
            ],
            effect: 'Allow'
          }
        ],
        taskRolePolicyStatements: [
          {
            actions: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
              'xray:GetSamplingRules',
              'xray:GetSamplingTargets',
              'xray:GetSamplingStatisticSummaries'
            ],
            resources: ['*'],
            effect: 'Allow'
          }
        ],
        taskExecutionDefaultAttachmentArn:
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy'
      },
      autoscalingConfig: {
        targetMinCapacity: 2,
        targetMaxCapacity: 10
      },
      alarms: {
        http5xxErrorPercentage: {
          //Triggers critical alert if 50% of request throws 5xx for
          // 4 continuous evaluation period for 20 mins (5 mins per period)
          threshold: 50,
          evaluationPeriods: 4,
          period: 300, //in seconds, 5 mins per period
          actions: config.isProd ? [pagerDuty.snsCriticalAlarmTopic.arn] : [],
        },
        httpLatency: {
          //Triggers non-critical alert if latency is above 500ms
          // for 4 continuous evaluation period for 1 hour (15 mins per period)
          evaluationPeriods: 4,
          threshold: 500,
          period: 900,//in seconds, 15 mins per period
          actions: config.isProd ? [pagerDuty.snsNonCriticalAlarmTopic.arn] : [],
        },
      },
    });
  }


  /**
   * Creates the elasticache and returns the node address list
   * @param scope
   * @private
   */
  private createElasticache(): string[] {
    const pocketVPC = new PocketVPC(this, 'pocket-vpc');

    const elasticache = new ApplicationMemcache(this, 'memcached', {
      //Usually we would set the security group ids of the service that needs to hit this.
      //However we don't have the necessary security group because it gets created in PocketALBApplication
      //So instead we set it to null and allow anything within the vpc to access it.
      //This is not ideal..
      //Ideally we need to be able to add security groups to the ALB application.
      allowedIngressSecurityGroupIds: undefined,
      node: {
        count: config.cacheNodes,
        size: config.cacheSize
      },
      subnetIds: pocketVPC.privateSubnetIds,
      tags: config.tags,
      vpcId: pocketVPC.vpc.id,
      prefix: config.prefix
    });

    let nodeList: string[] = [];
    for (let i = 0; i < config.cacheNodes; i++) {
      // ${elasticache.elasticacheClister.cacheNodes(i.toString()).port} has a bug and is not rendering the proper terraform address
      // its rendering -1.8881545897087503e+289 for some weird reason...
      // For now we just hardcode to 11211 which is the default memcache port.
      nodeList.push(
        `${
          elasticache.elasticacheCluster.cacheNodes(i.toString()).address
        }:11211`
      );
    }
    return nodeList;
  }
}

const app = new App();
new ClientAPI(app, 'client-api');
app.synth();
