import { IQueryColumnOut, IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { camelCase, toString } from 'lodash';
import { pascalCase } from '../utils/helper';

const notColumn = [
  'id',
  'created_at',
  'updated_at',
  'deleted_at',
  'created_user',
  'updated_user',
  'created_id',
  'updated_id',
  'deleted_id',
  'i18n',
];

let hasColJson = '';

const findTypeTxt = (p: IQueryColumnOut): [string, string, Array<string>, Array<string>] => {
  switch (p.dataType) {
    case 'bigint':
    case 'nvarchar':
    case 'varchar':
      return [
        'String',
        'string',
        ['@IsString()', `@MaxLength(${p.characterMaximumLength})`],
        ['IsString', 'MaxLength'],
      ];
    case 'timestamp': // GraphQLTimestamp
      return ['GraphQLTimestamp', 'string', ['@IsDate()'], ['IsDate']];
    case 'int':
      return ['Int', 'number', ['@IsInt()'], ['IsInt']];
    case 'decimal':
    case 'double':
      return ['Float', 'number', ['@IsNumber()'], ['IsNumber']];
    case 'datetime':
      return ['GraphQLISODateTime', 'Date', ['@IsDate()'], ['IsDate']];
    case 'boolean':
    case 'tinyint':
      return ['Boolean', 'boolean', ['@IsBoolean()'], ['IsBoolean']];
    case 'json':
      hasColJson = `import { GraphQLJSONObject } from 'graphql-type-json';`;
      return ['GraphQLJSONObject', 'Record<string, any>', ['@IsObject()'], ['IsObject']];
    default:
      return ['String', 'string', ['@IsString()'], ['IsString']];
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
  keyColumnList: IQueryKeyColumnOut[],
  inputCol = ''
): [string, Set<string>] => {
  const txtImport = new Set<string>();
  const columns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        const fileName = p.referencedTableName.replace(/_/g, '-');
        txtImport.add(
          `import { ${pascalCase(
            p.referencedTableName
          )}Entity } from '../../lib/model/${fileName}.entity';`
        );
        if (p.referencedTableName !== p.tableName) {
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}${inputCol} } from '../${fileName}/${fileName}.gql';`
          );
        }
        let hasManyTemp = '';
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          hasManyTemp = `
  @Field(() => [${pascalCase(p.referencedTableName)}${inputCol}], { nullable: true })
  ${camelCase(p.tableName)}${pascalCase(p.columnName)}: Array<${pascalCase(p.tableName)}Entity>;
`;
        }
        // 子表 外键 BelongsTo
        return `
  @Field(() => ${pascalCase(p.referencedTableName)}${inputCol}, { nullable: true })
  ${camelCase(p.columnName)}Obj: ${pascalCase(p.referencedTableName)}Entity;
${hasManyTemp}`;
      } else {
        if (p.referencedTableName !== p.tableName) {
          const fileName = p.tableName.replace(/_/g, '-');
          txtImport.add(
            `import { ${pascalCase(p.tableName)}Entity } from '../../lib/model/${fileName}.entity';`
          );
          txtImport.add(
            `import { ${pascalCase(
              p.tableName
            )}${inputCol} } from '../${fileName}/${fileName}.gql';`
          );
        }

        // 主表 主键 Hasmany
        return `
  @Field(() => [${pascalCase(p.tableName)}${inputCol}], { nullable: true })
  ${camelCase(p.tableName)}${pascalCase(p.columnName)}: Array<${pascalCase(p.tableName)}Entity>;
`;
      }
    })
    .join(``);
  return [columns, txtImport];
};

const findColumn = (
  columnList: IQueryColumnOut[],
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[]
): [string, string, string, string, string] => {
  const validateImport = new Set<string>();
  const gqlTypeImport = new Set<string>();
  const normal = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const [gqlType, type, valType, validateImp] = findTypeTxt(p);
      validateImp.forEach((v) => validateImport.add(v));
      gqlTypeImport.add(gqlType);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;

      const nullable = p.isNullable === 'YES' ? '?' : '';
      const gqlNullable = p.isNullable === 'YES' ? 'nullable: true ' : '';
      return `  /**
   * ${comment}
   */
  ${valType.join(`
   `)}
    @Field(() => ${gqlType}, {
    description: '${comment}',${gqlNullable}
  })
  ${propertyName}${nullable}: ${type};
`;
    });
  // 弃用 采用resolver方式
  // const [columns, txtImport] = findForeignKey(tableItem, keyColumnList);
  const [inputColumns, inputTxtImport] = findForeignKey(tableItem, keyColumnList, 'SaveIn');
  // inputTxtImport.forEach((p) => txtImport.add(p));
  return [
    normal.join(''),
    [...normal, inputColumns].join(''),
    Array.from(inputTxtImport).join(''),
    Array.from(gqlTypeImport)
      .filter((p) => !['String', 'Boolean', 'GraphQLJSONObject', 'Int'].includes(p))
      .join(', '),
    Array.from(validateImport).join(','),
  ];
};

/**
 * 主力输出
 * @param columnList
 * @param tableItem
 * @param keyColumnList
 * @returns
 */
export const send = ({ columnList, tableItem, keyColumnList }: ISend) => {
  hasColJson = '';
  const [columns, inputColumns, txtImport, typeImport, valImport] = findColumn(
    columnList,
    tableItem,
    keyColumnList
  );

  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    inputColumns,
    columns: toString(columns),
    txtImport: txtImport,
    typeImport: typeImport,
    validatorImport: valImport,
  });
};

const modelTemplate = ({
  className,
  columns,
  inputColumns,
  txtImport,
  typeImport,
  validatorImport,
}: {
  className: string;
  columns: string;
  inputColumns: string;
  txtImport: string;
  typeImport: string;
  validatorImport: string;
}): string => {
  const txt = `import { Field, ObjectType, InputType, Int, ${typeImport} } from 'type-graphql';${txtImport}${hasColJson}
import { ${validatorImport} } from 'class-validator';
import {
  GqlInputTypeBase,
  GqlObjectTypeBase,
} from '../../lib/base/gql-type.base';

@ObjectType()
export class ${className} extends GqlObjectTypeBase {
  ${columns}
}

@ObjectType()
export class ${className}List {
  @Field(() => [${className}], { nullable: true })
  list: Array<${className}>;

  @Field(() => Int, { nullable: true })
  count: number;
}

@InputType()
export class ${className}SaveIn extends GqlInputTypeBase {
  ${inputColumns}
}

`;
  return txt;
};
