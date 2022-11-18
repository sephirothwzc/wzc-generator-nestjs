import { camelCase, upperFirst } from 'lodash';

/**
 * 帕斯卡命名
 */
export const pascalCase = (name: string) => {
  return upperFirst(camelCase(name));
};
