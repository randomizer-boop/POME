import type { AccountType } from '../../shared/types';
import { t } from '../../shared/i18n';

export const ACCOUNT_IDS: AccountType[] = ['cash', 'main', 'savings'];
export const accName = (a: AccountType) => t(`account.${a}` as const);
