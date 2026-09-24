import { Construct } from 'constructs';
import { App, S3Backend, TerraformStack } from 'cdktf';
import {
  AwsProvider,
  datasources,
  kms,
  route53,
  sns,
} from '@cdktf/provider-aws';
import { config } from './config';
import {
  PocketALBApplication,
  PocketPagerDuty,
  PocketECSCodePipeline,
} from '@pocket-tools/terraform-modules';
import { PagerdutyProvider } from '@cdktf/provider-pagerduty';
import { LocalProvider } from '@cdktf/provider-local';
import { NullProvider } from '@cdktf/provider-null';

class AdminAPI extends TerraformStack {
  constructor(scope: Construct, name: string) {
    super(scope, name);

    new AwsProvider(this, 'aws', { region: 'us-east-1' });
    new PagerdutyProvider(this, 'pagerduty_provider', { token: undefined });
    new LocalProvider(this, 'local_provider');
    new NullProvider(this, 'null_provider');

    new S3Backend(this, {
      bucket: `mozilla-content-team-${config.environment.toLowerCase()}-terraform-state`,
      dynamodbTable: `mozilla-content-team-${config.environment.toLowerCase()}-terraform-state`,
      key: config.name,
      region: 'us-east-1',
    });

    const region = new datasources.DataAwsRegion(this, 'region');
    const caller = new datasources.DataAwsCallerIdentity(this, 'caller');

    const pocketApp = this.createPocketAlbApplication({
      pagerDuty: this.createPagerDuty(),
      secretsManagerKmsAlias: this.getSecretsManagerKmsAlias(),
      snsTopic: this.getCodeDeploySnsTopic(),
      region,
      caller,
    });
    this.detachDnsManagedByTheWafCutover(pocketApp);
    this.createApplicationCodePipeline(pocketApp);
  }

  /**
   * admin-api is served through the Fastly WAF edge (INFRASEC-3068). During
   * the cutover this service's records were mirrored into the root
   * getpocket.dev / getpocket.com zone, the per-service sub-zone and its NS
   * delegation were deleted, and the record for `domain` became a CNAME to the
   * Fastly edge, maintained outside this stack (SREIN-1800, SREIN-1811).
   *
   * The pinned version of terraform-modules has no option for that shape, so
   * the three affected constructs are detached here and the surviving
   * certificate validation record is repointed at the root zone. Detaching
   * them leaves every other resource address in this stack unchanged.
   * @private
   */
  private detachDnsManagedByTheWafCutover(pocketApp: PocketALBApplication) {
    //This detaches constructs by their internal ids and depends on the
    //logical ids the pinned version generates. A different version renames
    //every resource in this stack, which terraform reads as
    //destroy-and-recreate, so fail before anything is planned or applied.
    const PINNED_MODULE_VERSION = '4.6.1';
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const installed: string = require('@pocket-tools/terraform-modules/package.json')
      .version;
    if (installed !== PINNED_MODULE_VERSION) {
      throw new Error(
        `@pocket-tools/terraform-modules is ${installed}, but this stack pins ${PINNED_MODULE_VERSION}. ` +
          'detachDnsManagedByTheWafCutover relies on the logical ids that version generates, ' +
          'and a different version renames every resource in this stack. Revisit it before changing the pin.',
      );
    }

    //deleted during the cutover; the name is maintained outside this stack
    pocketApp.baseDNS.node.tryRemoveChild('subhosted_zone');
    pocketApp.baseDNS.node.tryRemoveChild('subhosted_zone_ns');
    //without a CDN this is the record for `domain` itself, which is now the
    //CNAME to the Fastly edge
    pocketApp.node.tryRemoveChild('alb_record');

    //the ACM validation record survives, but lives in the root zone now
    const rootZone = pocketApp.node.findChild(
      'base_dns_main_hosted_zone',
    ) as route53.DataAwsRoute53Zone;
    const certificateRecord = pocketApp.node
      .findChild('alb_certificate')
      .node.findChild('certificate_record') as route53.Route53Record;
    certificateRecord.addOverride('zone_id', rootZone.zoneId);
  }

  /**
   * Get the sns topic for code deploy
   * @private
   */
  private getCodeDeploySnsTopic() {
    return new sns.DataAwsSnsTopic(this, 'backend_notifications', {
      name: `Backend-${config.environment}-ChatBot`,
    });
  }

  /**
   * Get secrets manager kms alias
   * @private
   */
  private getSecretsManagerKmsAlias() {
    return new kms.DataAwsKmsAlias(this, 'kms_alias', {
      name: 'alias/aws/secretsmanager',
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
        branchName: config.codePipeline.branch,
      },
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

    return new PocketPagerDuty(this, 'pagerduty', {
      prefix: config.prefix,
      service: {
        // This is a Tier 2 service and as such only raises non-critical alarms.
        criticalEscalationPolicyId: 'PXOQVEP',
        nonCriticalEscalationPolicyId: 'PXOQVEP',
      },
    });
  }

  private createPocketAlbApplication(dependencies: {
    pagerDuty?: PocketPagerDuty;
    region: datasources.DataAwsRegion;
    caller: datasources.DataAwsCallerIdentity;
    secretsManagerKmsAlias: kms.DataAwsKmsAlias;
    snsTopic: sns.DataAwsSnsTopic;
  }): PocketALBApplication {
    const { pagerDuty, region, caller, secretsManagerKmsAlias, snsTopic } =
      dependencies;

    return new PocketALBApplication(this, 'application', {
      internal: false, //set to true to put it inside our vpc
      prefix: config.prefix,
      alb6CharacterPrefix: config.shortName,
      tags: config.tags,
      cdn: false,
      domain: config.domain,
      accessLogs: {
        existingBucket: config.s3LogsBucket,
      },
      containerConfigs: [
        {
          name: 'app',
          portMappings: [
            {
              hostPort: 4027,
              containerPort: 4027,
              protocol: 'tcp',
            },
          ],
          envVars: [
            {
              name: 'NODE_ENV',
              value: process.env.NODE_ENV, // this gives us a nice lowercase production and development
            },
            {
              name: 'APOLLO_GRAPH_REF',
              value: `${config.envVars.graph.graphId}@${config.envVars.graph.graphVariant}`,
            },
          ],
          secretEnvVars: [
            {
              name: 'SENTRY_DSN',
              valueFrom: `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/SENTRY_DSN`,
            },
            {
              name: 'APOLLO_KEY',
              valueFrom: `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/APOLLO_KEY`,
            },
          ],
          healthCheck: {
            command: [
              'CMD-SHELL',
              'curl -f http://localhost:4027/.well-known/apollo/server-health || exit 1',
            ],
            interval: 15,
            retries: 3,
            timeout: 5,
            startPeriod: 0,
          },
        },
        {
          name: 'xray-daemon',
          containerImage: 'amazon/aws-xray-daemon',
          repositoryCredentialsParam: `arn:aws:secretsmanager:${region.name}:${caller.accountId}:secret:Shared/DockerHub`,
          portMappings: [
            {
              hostPort: 2000,
              containerPort: 2000,
              protocol: 'udp',
            },
          ],
          command: ['--region', 'us-east-1', '--local-mode'],
        },
      ],
      codeDeploy: {
        useCodeDeploy: true,
        useCodePipeline: true,
        snsNotificationTopicArn: snsTopic.arn,
        notifications: {
          //only notify on failed deploys
          notifyOnFailed: true,
          notifyOnStarted: false,
          notifyOnSucceeded: false,
        },
      },
      exposedContainer: {
        name: 'app',
        port: 4027,
        healthCheckPath: '/.well-known/apollo/server-health',
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
              secretsManagerKmsAlias.targetKeyArn,
            ],
            effect: 'Allow',
          },
          //This policy could probably go in the shared module in the future.
          {
            actions: ['ssm:GetParameter*'],
            resources: [
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}`,
              `arn:aws:ssm:${region.name}:${caller.accountId}:parameter/${config.name}/${config.environment}/*`,
            ],
            effect: 'Allow',
          },
        ],
        taskRolePolicyStatements: [
          {
            actions: [
              'xray:PutTraceSegments',
              'xray:PutTelemetryRecords',
              'xray:GetSamplingRules',
              'xray:GetSamplingTargets',
              'xray:GetSamplingStatisticSummaries',
            ],
            resources: ['*'],
            effect: 'Allow',
          },
        ],
        taskExecutionDefaultAttachmentArn:
          'arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy',
      },
      autoscalingConfig: {
        targetMinCapacity: 2,
        targetMaxCapacity: 10,
      },
      alarms: {
        http5xxErrorPercentage: {
          //Triggers non-critical alert if 50% of request throws 5xx for
          // 4 continuous evaluation period for 20 mins (5 mins per period)
          threshold: 50,
          evaluationPeriods: 4,
          period: 300, //in seconds, 5 mins per period
          actions: config.isProd
            ? [pagerDuty.snsNonCriticalAlarmTopic.arn]
            : [],
        },
        httpLatency: {
          //Triggers non-critical alert if latency is above 500ms
          // for 4 continuous evaluation period for 1 hour (15 mins per period)
          evaluationPeriods: 4,
          threshold: 500,
          period: 900, //in seconds, 15 mins per period
          actions: config.isProd
            ? [pagerDuty.snsNonCriticalAlarmTopic.arn]
            : [],
        },
      },
    });
  }
}

const app = new App();
new AdminAPI(app, 'admin-api');
app.synth();
