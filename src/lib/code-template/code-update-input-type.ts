import { IQueryColumnOut, ISend } from '../code-generator';
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

const findColumn = (columnList: IQueryColumnOut[]): [string, Set<string>, Set<string>] => {
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

      const nullable = p.isNullable === 'YES' ? '?' : '';
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

  return [normal.join(''), importGqlType, importOtherType];
};

export const send = ({ columnList, tableItem }: ISend) => {
  const [columns, importGqlType, importOtherType] = findColumn(columnList);

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
export class Update${className}Input {
${columns}
}
`;
  return txt;
};
