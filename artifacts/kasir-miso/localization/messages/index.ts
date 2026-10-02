import cashierMessages from './cashier';
import commonMessages from './common';
import managementMessages from './management';
import operationsMessages from './operations';
import recordsMessages from './records';
import sharedMessages from './shared';

export const englishMessages: Record<string, string> = {
  ...commonMessages,
  ...cashierMessages,
  ...recordsMessages,
  ...operationsMessages,
  ...managementMessages,
  ...sharedMessages,
};