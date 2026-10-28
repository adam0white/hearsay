/** Current passport source must match the installed public framework package exactly. */
import framework from '@adam0white/human-framework/package.json' with { type: 'json' };

export const GARDEN_ENGINE = framework.version;
