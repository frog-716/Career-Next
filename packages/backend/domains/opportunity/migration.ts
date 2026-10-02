import {companyMigration} from './company/public';
import {coreMigration} from './core/public';
export const opportunityMigration=companyMigration+'\n'+coreMigration;
