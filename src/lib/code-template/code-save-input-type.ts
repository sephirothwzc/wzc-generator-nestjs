import { IQueryColumnOut, IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { camelCase, toString } from 'lodash';
import { pascalCase } from '../utils/helper';

const notColumn = [
  // 'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_user',
  'updated_user',
  'created_id',
  'updated_id',
  'deleted_id',
  'i18n',
  'version',
  'business_code',
  'version',
];

const findTypeTxt = (p: IQueryColumnOut): string => {
  switch (p.dataType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
      return 'string';
    case 'timestamp':
    case 'int':
    case 'decimal':
    case 'double':
      return `number`;
    case 'datetime':
      return `Date`;
    case 'boolean':
    case 'tinyint':
      return 'boolean';
    case 'json':
      return 'any';
    case 'point':
      return 'PointInput';
    default:
      return 'string';
  }
};

const findGqlTypeTxt = (p: IQueryColumnOut): string => {
  switch (p.dataType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
      return 'String';
    case 'int':
      return 'Int';
    case 'decimal':
    case 'double':
      return 'Float';
    case 'timestamp': // GraphQLTimestamp
    case 'datetime':
      return 'GraphQLISODateTime';
    case 'boolean':
    case 'tinyint':
      return 'Boolean';
    case 'point':
      return 'PointInput';
    case 'json': {
      return 'GraphQLJSONObject';
    }
    default:
      return 'String';
  }
};

/**
 * 根据key生成主外建对象 增加 import
 * @param {*} typeString
 * @param {*} enumTypeName
 * @param {*} sequelizeType
 * @param {*} columnRow
 */
const findForeignKey = (
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[]
): [string, Set<string>, boolean] => {
  const txtImport = new Set<string>();
  let importHasManyTo = false;
  const columns = keyColumnList
    .filter((p) => p.tableName !== tableItem.tableName)
    .map((p) => {
      p.referencedTableName !== p.tableName &&
        txtImport.add(
          `import { Save${pascalCase(p.tableName)}Input } from 'src/${p.tableName.replace(
            /_/g,
            '-'
          )}/dto/save-${p.tableName.replace(/_/g, '-')}.input';`
        );
      importHasManyTo = true;
      // 主表 主键 Hasmany
      return `  /**
   * 
   */
  @Field(() => [Save${pascalCase(p.tableName)}Input], {
    nullable: true,
  })
  ${camelCase(p.tableName)}${pascalCase(p.columnName)}?: Array<Save${pascalCase(p.tableName)}Input>;
`;
    })
    .join(``);
  return [columns, txtImport, importHasManyTo];
};

const findColumn = (
  columnList: IQueryColumnOut[],
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[]
): [string, Set<string>, Set<string>] => {
  // 类型
  const importGqlType = new Set<string>();
  // 其他类型
  const importOtherType = new Set<string>();
  const normal = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const type = findTypeTxt(p);
      const gqlType = findGqlTypeTxt(p);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;

      const nullable = p.isNullable === 'YES' || p.columnName === 'id' ? '?' : '';
      // #region gqltype
      if (
        gqlType !== 'String' &&
        gqlType !== 'Boolean' &&
        gqlType !== 'PointInput' &&
        gqlType !== 'GraphQLJSONObject'
      ) {
        importGqlType.add(gqlType);
      } else if (gqlType === 'PointInput') {
        importOtherType.add("import { PointInput } from 'src/utils/input-type/point-input';");
      } else if (gqlType === 'GraphQLJSONObject') {
        importOtherType.add("import { GraphQLJSONObject } from 'graphql-scalars';");
      }
      // #endregion

      return `  /**
   * ${comment}
   */
  @Field(() => ${gqlType}, { description: '${comment}', nullable: true })
  ${propertyName}${nullable}: ${type};
`;
    });

  const [columns, txtImport] = findForeignKey(tableItem, keyColumnList);

  Array.from(txtImport).forEach((p) => importOtherType.add(p));
  return [[...normal, columns].join(''), importGqlType, importOtherType];
};

export const send = ({ columnList, tableItem, keyColumnList }: ISend) => {
  const [columns, importGqlType, importOtherType] = findColumn(
    columnList,
    tableItem,
    keyColumnList
  );

  return modelTemplate({
    tableName: tableItem.tableName,
    className: pascalCase(tableItem.tableName),
    columns: toString(columns),
    txtImport: Array.from(importOtherType as Set<string>).join(''),
    gqlTypeImport: Array.from(importGqlType).join(','),
  });
};

/**
 *
 * @param param0
 * @returns
 */
const modelTemplate = ({
  className,
  columns,
  txtImport,
  gqlTypeImport,
}: {
  tableName: string;
  className: string;
  columns: string;
  txtImport: string;
  gqlTypeImport: string;
}): string => {
  const txt = `import { InputType, Field, ${gqlTypeImport} } from '@nestjs/graphql';
${txtImport}

@InputType()
export class Save${className}Input {
${columns}
}
`;
  return txt;
};
