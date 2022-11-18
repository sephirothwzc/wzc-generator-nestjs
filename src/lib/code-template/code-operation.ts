import { ISend } from '../code-generator';
import { camelCase } from 'lodash';
import { pascalCase } from '../utils/helper';

const modelTemplate = ({ funName, className }: { funName: string; className: string }) => {
  return `# 查询
extend type query {
  # ${funName} 总行数
  ${funName}Count(param: QueryListParam): Int
  # ${funName} 分页查询
  ${funName}List(param: QueryListParam): ${className}List
  # ${funName}  id 获取
  ${funName}(id: ID!): ${className}
  # ${funName} 有条件返回
  ${funName}All(param: QueryListParam): [${className}]
}

# 操作
extend type mutation {
  # ${funName} 新增 or 修改
  ${funName}(param: ${className}SaveIn!): ${className}
  # ${funName} 批量 新增 or 修改
  ${funName}Bulk(param: [${className}SaveIn]!): [${className}]
  # ${funName} 根据id删除
  ${funName}Destroy(id: ID!): String
}`;
};

export const send = ({ tableItem }: ISend) => {
  return modelTemplate({
    funName: camelCase(tableItem.tableName),
    className: pascalCase(tableItem.tableName),
  });
};
