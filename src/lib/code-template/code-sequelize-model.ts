import { IQueryColumnOut, IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { camelCase, toString, toUpper } from 'lodash';
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
      return 'Record<string, any>';
    default:
      return 'string';
  }
};

/**
 * 根据key生成主外建对象 增加 import
 * @param {*} typeString
 * @param {*} enumTypeName
 * @param {*} sequelizeType
 * @param {*} columnRow
 */
const findForeignKey = (tableItem: IQueryTableOut, keyColumnList: IQueryKeyColumnOut[]) => {
  const txtImport = new Set();
  let importBelongsTo = false;
  let importHasManyTo = false;
  const columns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        p.referencedTableName !== p.tableName &&
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}Model } from './${p.referencedTableName.replace(/_/g, '-')}.model';`
          );
        importBelongsTo = true;
        let hasManyTemp = '';
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          importHasManyTo = true;
          hasManyTemp = `
  @HasMany(() => ${pascalCase(p.tableName)}Model, '${p.columnName}')
  ${camelCase(p.tableName)}${pascalCase(p.columnName)}: Array<${pascalCase(p.tableName)}Model>;
`;
        }
        // 子表 外键 BelongsTo
        return `
  @BelongsTo(() => ${pascalCase(p.referencedTableName)}Model, '${p.columnName}')
  ${camelCase(p.columnName)}Obj: ${pascalCase(p.referencedTableName)}Model;
${hasManyTemp}`;
      } else {
        p.referencedTableName !== p.tableName &&
          txtImport.add(
            `import { ${pascalCase(p.tableName)}Model } from './${p.tableName.replace(
              /_/g,
              '-'
            )}.model';`
          );
        importHasManyTo = true;
        // 主表 主键 Hasmany
        return `
  @HasMany(() => ${pascalCase(p.tableName)}Model, '${p.columnName}')
  ${camelCase(p.tableName)}${pascalCase(p.columnName)}: Array<${pascalCase(p.tableName)}Model>;
`;
      }
    })
    .join(``);
  return [columns, txtImport, importBelongsTo, importHasManyTo];
};

const findColumn = (
  columnList: IQueryColumnOut[],
  tableItem: IQueryTableOut,
  keyColumnList: IQueryKeyColumnOut[]
) => {
  let importForeignKeyTo = false;
  let importDataType = false;
  const normal = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      const type = findTypeTxt(p);
      const propertyName = camelCase(p.columnName);
      const comment = p.columnComment || p.columnName;

      const nullable = p.isNullable === 'YES' ? '?' : '';
      // json 需要增加 type
      const sequelizeModelType = p.dataType === 'json' ? 'type: DataType.JSON,' : '';
      importDataType = importDataType || p.dataType === 'json';

      const foreignKey = keyColumnList.find(
        (columnRow) =>
          columnRow.tableName === tableItem.tableName && columnRow.columnName === p.columnName
      );
      // 不需要引入 因为obj 时候会单独处理
      const foreignKeyTxt = foreignKey
        ? `
  @ForeignKey(() => ${pascalCase(foreignKey.referencedTableName)}Model)`
        : '';
      foreignKeyTxt && (importForeignKeyTo = true);

      return `  /**
   * ${comment}
   */${foreignKeyTxt}
   @Column({
    comment: '${comment}',${sequelizeModelType}
  })
  ${propertyName}${nullable}: ${type};
`;
    });
  const constTxt = columnList
    .filter((p) => !notColumn.includes(p.columnName))
    .map((p) => {
      return `
  /**
   * ${p.columnComment}
   */
  public static readonly ${toUpper(p.columnName)} = '${camelCase(p.columnName)}';
`;
    });
  const [columns, txtImport, importBelongsTo, importHasManyTo] = findForeignKey(
    tableItem,
    keyColumnList
  );

  return [
    [...normal, columns].join(''),
    txtImport,
    importBelongsTo,
    importHasManyTo,
    importForeignKeyTo,
    constTxt.join(''),
    importDataType,
  ];
};

export const send = ({ columnList, tableItem, keyColumnList }: ISend) => {
  const [
    columns,
    txtImport,
    importBelongsTo,
    importHasManyTo,
    importForeignKeyTo,
    constTxt,
    importDataType,
  ] = findColumn(columnList, tableItem, keyColumnList);

  const seuqliezeTypeImport = new Set(['Table', 'Column']);
  importBelongsTo && seuqliezeTypeImport.add('BelongsTo');
  importHasManyTo && seuqliezeTypeImport.add('HasMany');
  importForeignKeyTo && seuqliezeTypeImport.add('ForeignKey');
  importDataType && seuqliezeTypeImport.add('DataType');

  return modelTemplate({
    tableName: tableItem.tableName,
    className: pascalCase(tableItem.tableName),
    columns: toString(columns),
    txtImport: Array.from(txtImport as Set<string>).join(''),
    seuqliezeTypeImport: Array.from(seuqliezeTypeImport).join(','),
    constTxt: constTxt as string,
  });
};

/**
 *
 * @param param0
 * @returns
 */
const modelTemplate = ({
  tableName,
  className,
  columns,
  txtImport,
  seuqliezeTypeImport,
  constTxt,
}: {
  tableName: string;
  className: string;
  columns: string;
  txtImport: string;
  seuqliezeTypeImport: string;
  constTxt: string;
}): string => {
  const txt = `import { ${seuqliezeTypeImport} } from 'sequelize-typescript';
import { BaseModel } from '../base.model';
import { CONST_MODEL } from '../const-model';${txtImport}

@Table({ modelName: '${tableName}' })
export class ${className}Model extends BaseModel {
${columns}
}

/**
 * ${toUpper(tableName)}
 */
export class ${toUpper(tableName)} extends CONST_MODEL {
${constTxt}
}
`;
  return txt;
};
