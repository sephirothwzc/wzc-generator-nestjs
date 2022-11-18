import { IQueryColumnOut, ISend } from '../code-generator';
import { camelCase } from 'lodash';
import { pascalCase } from '../utils/helper';

const modelTemplate = ({
  funName,
  className,
  propertyItem,
}: {
  funName: string;
  className: string;
  propertyItem: string;
}) => {
  return `# 分页加载
query find${className}List($param: QueryListParam) {
  ${funName}All(param: $param) {
    ...${className}
  }
  ${funName}Count(param: $param)
}

# 加载全部
query find${className}All($param: QueryListParam) {
  ${funName}All(param: $param) {
    ...${className}
  }
}

# 单个对象获取
query find${className}($id: ID!) {
  ${funName}(id: $id) {
    ...${className}Item
  }
}

# 新增,编辑
mutation ${funName}($param: ${className}SaveIn!) {
  ${funName}(param: $param) {
    id
  }
}

# 删除
mutation ${funName}Destroy($id: ID!) {
  ${funName}Destroy(id: $id)
}

# 列表对象
fragment ${className} on ${className} {
  ${propertyItem}
}

# 单个对象
fragment ${className}Item on ${className} {
  ${propertyItem}
}

# excel 导出
query Export${className}All(
  $param: QueryListParam!
  $dataRoot: String!
  $columns: [ExportColumn!]!
  $fileName: String!
) {
  ${funName}All(param: $param) {
    ...${className}
  }
  exportExcel(dataRoot: $dataRoot, columns: $columns, fileName: $fileName)
}
`;
};

const notColumn = [
  'updated_at',
  'deleted_at',
  'created_user',
  'updated_user',
  'updated_id',
  'deleted_id',
  'i18n',
  'business_code',
];

/**
 * 获取列属性
 * @param columnList
 */
const findPropertyItem = (columnList: Array<IQueryColumnOut>) => {
  const list = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => camelCase(p.columnName));
  return list.join(`
`);
};

export const send = ({ tableItem, columnList }: ISend) => {
  return modelTemplate({
    funName: camelCase(tableItem.tableName),
    className: pascalCase(tableItem.tableName),
    propertyItem: findPropertyItem(columnList),
  });
};
