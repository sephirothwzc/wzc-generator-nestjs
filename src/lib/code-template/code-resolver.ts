import { camelCase } from 'lodash';
import { IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { pascalCase } from '../utils/helper';

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
): [string, Set<string>, Set<string>] => {
  const txtImport = new Set<string>();
  const injectService = new Set<string>();
  const columns = keyColumnList
    .map((p) => {
      if (p.tableName === tableItem.tableName) {
        if (p.referencedTableName !== p.tableName) {
          const fileName = p.referencedTableName.replace(/_/g, '-');
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}Entity } from '../lib/model/${fileName}.entity';`
          );
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}${inputCol} } from '../graphql/${fileName}/${fileName}.gql';`
          );
        }
        let hasManyTemp = '';
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          hasManyTemp = `
  @FieldResolver(returns => [${pascalCase(p.referencedTableName)}${inputCol}], { nullable: true })
  async  ${camelCase(p.tableName)}${pascalCase(p.columnName)}(
    @Root() root: ${pascalCase(tableItem.tableName)}Entity,
    @Ctx() ctx: Context
  ): Promise<Array<${pascalCase(p.tableName)}Entity>> {
    if (!root.get('id')) {
      return undefined;
    }
    return this.${camelCase(p.tableName)}Service.findAll({ where: { 
            ${camelCase(p.columnName)}: root.get('id') 
          }});
  }
  `;
        } else {
          const fileName = p.referencedTableName.replace(/_/g, '-');
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}Service } from '../service/${fileName}.service';`
          );
          // 非自我关联 增加 inject
          injectService.add(`  @Inject()
  ${camelCase(p.referencedTableName)}Service: ${pascalCase(p.referencedTableName)}Service;
`);
        }
        // 子表 外键 BelongsTo
        return `  
  @FieldResolver(returns => ${pascalCase(p.referencedTableName)}${inputCol}, { nullable: true })
  async ${camelCase(p.columnName)}Obj(
    @Root() root: ${pascalCase(tableItem.tableName)}Entity,
    @Ctx() ctx: Context
  ): Promise<${pascalCase(p.referencedTableName)}Entity> {
    if (!root.get('${camelCase(p.columnName)}')) {
      return undefined;
    }
    return this.${camelCase(p.referencedTableName)}Service.findByPk<${pascalCase(
          p.referencedTableName
        )}Entity>(root.get('${camelCase(p.columnName)}'));
  }
${hasManyTemp}`;
      } else {
        if (p.referencedTableName !== p.tableName) {
          const fileName = p.tableName.replace(/_/g, '-');
          txtImport.add(
            `import { ${pascalCase(p.tableName)}Entity } from '../lib/model/${fileName}.entity';`
          );
          txtImport.add(
            `import { ${pascalCase(
              p.tableName
            )}${inputCol} } from '../graphql/${fileName}/${fileName}.gql';`
          );
          txtImport.add(
            `import { ${pascalCase(p.tableName)}Service } from '../service/${fileName}.service';`
          );
          injectService.add(`  @Inject()
  ${camelCase(p.tableName)}Service: ${pascalCase(p.tableName)}Service;
`);
        }

        // 主表 主键 Hasmany
        return `
  @FieldResolver(returns => [${pascalCase(p.tableName)}${inputCol}], { nullable: true })
  async  ${camelCase(p.tableName)}${pascalCase(p.columnName)}(
    @Root() root: ${pascalCase(tableItem.tableName)}Entity,
    @Ctx() ctx: Context
  ): Promise<Array<${pascalCase(p.tableName)}Entity>> {
    if (!root.get('id')) {
      return undefined;
    }
    return this.${camelCase(p.tableName)}Service.findAll({ where: { 
            ${camelCase(p.columnName)}: root.get('id') 
          }});
  }
  `;
      }
    })
    .join(``);
  if (columns) {
    txtImport.add(`import { Context } from '@midwayjs/koa';`);
  }
  return [columns, txtImport, injectService];
};

const modelTemplate = ({
  className,
  funName,
  modelFileName,
  filedResolver,
  importFiled,
  injectService,
}: {
  className: string;
  funName: string;
  modelFileName: string;
  filedResolver: string;
  importFiled: string;
  injectService: string;
}) => {
  return `import { Provide, Inject } from '@midwayjs/decorator';
import ResolverBase from '../lib/base/resolver.base';
import Bb from 'bluebird';
import { Resolver, Query, Arg, Int, Mutation, ID ${
    filedResolver ? ',FieldResolver, Root, Ctx' : ''
  } } from 'type-graphql';
import {
  ${className},
  ${className}SaveIn,
  ${className}List,
} from '../graphql/${modelFileName}/${modelFileName}.gql';
import QueryListParam from '../graphql/utils/query-list-param.gql';
import { ${className}Service } from '../service/${modelFileName}.service';
import { ${className}Entity } from '../lib/model/${modelFileName}.entity';
${importFiled}

@Provide()
@Resolver(() => ${className})
export default class ${className}Resolver extends ResolverBase {
  @Inject()
  ${funName}Service: ${className}Service;
  ${injectService}

  @Query(type => Int)
  async ${funName}Count(
    @Arg('param', () => QueryListParam, { nullable: true })
    param: QueryListParam
  ): Promise<number> {
    return this.${funName}Service.findCount(param);
  }

  @Query(returns => ${className}List, { nullable: true })
  async ${funName}List(
    @Arg('param', type => QueryListParam, { nullable: true })
    param: QueryListParam
  ): Promise<{
    list: ${className}Entity[];
    count: number;
  }> {
    return Bb.props({
      list: this.${funName}Service.findAll(param),
      count: this.${funName}Service.findCount(param),
    });
  }

  @Query(returns => ${className}, { nullable: true })
  async ${funName}(@Arg('id', type => ID) id: string): Promise<${className}Entity> {
    return this.${funName}Service.findByPk(id);
  }
  @Query(returns => [${className}])
  async ${funName}All(
    @Arg('param', type => QueryListParam, { nullable: true })
    param: QueryListParam
  ): Promise<Array<${className}>> {
    return this.${funName}Service.findAll(param) as any;
  }

  @Mutation(returns => ${className}, {
    name: '${funName}',
  })
  async ${funName}Save(
    @Arg('param', type => ${className}SaveIn) param: ${className}Entity
  ): Promise<${className}Entity> {
    return this.${funName}Service.save(param);
  }

  @Mutation(returns => [${className}], { nullable: true })
  async ${funName}Bulk(
    @Arg('param', type => [${className}SaveIn]) param: [${className}Entity]
  ): Promise<${className}Entity[]> {
    return this.${funName}Service.bulkSave(param);
  }

  @Mutation(returns => String, { nullable: true })
  async ${funName}Destroy(@Arg('id', type => ID) id: string): Promise<string> {
    return this.${funName}Service.destroyById(id);
  }
  ${filedResolver}
}
`;
};

export const send = ({ tableItem, keyColumnList }: ISend) => {
  const [filedResolver, importFiled, injectService] = findForeignKey(tableItem, keyColumnList);
  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    funName: camelCase(tableItem.tableName),
    modelFileName: tableItem.tableName.replace(/_/g, '-'),
    filedResolver,
    importFiled: Array.from(importFiled).join(''),
    injectService: Array.from(injectService).join(''),
  });
};
