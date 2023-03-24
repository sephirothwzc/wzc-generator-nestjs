import { camelCase } from 'lodash';
import { IQueryKeyColumnOut, IQueryTableOut, ISend } from '../code-generator';
import { pascalCase } from '../utils/helper';

/**
 * 根据key生成主外建对象 增加 import
 * @param tableItem
 * @param keyColumnList
 * @param inputCol
 * @returns
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
            )} } from 'src/${fileName}/entities/${fileName}.entity';`
          );
        }
        let hasManyTemp = '';
        // 自我关联
        if (p.referencedTableName === tableItem.tableName) {
          hasManyTemp = `
  @ResolveField(() => [${pascalCase(p.referencedTableName)}${inputCol}], { nullable: true })
  async  ${camelCase(p.tableName)}${pascalCase(p.columnName)}(
    @Parent() parent: ${pascalCase(
      tableItem.tableName
    )}, // Resolved object that implements Character
    @Info() { info }, // Type of the object that implements Character
    @Args('param', { type: () => FindAllInput, nullable: true })
    param: FindAllInput,
  ) {
    if (parent.id) {
      return undefined;
    }
    // Get character's friends
    return this.${camelCase(p.tableName)}Service.findAll({
      ...param,
      where: {
        ${camelCase(p.columnName)}: parent.id,
        ...param?.where,
      },
    });

  }
  `;
        } else {
          const fileName = p.referencedTableName.replace(/_/g, '-');
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )} } from 'src/${fileName}/entities/${fileName}.entity';`
          );
          txtImport.add(
            `import { ${pascalCase(
              p.referencedTableName
            )}Service } from 'src/${fileName}/${fileName}.service';`
          );

          // 非自我关联 增加 inject
          injectService.add(
            `private readonly ${camelCase(p.referencedTableName)}Service: ${pascalCase(
              p.referencedTableName
            )}Service`
          );
        }
        // 子表 外键 BelongsTo
        return `  
  @ResolveField(() => ${pascalCase(p.referencedTableName)}${inputCol}, { nullable: true })
  async ${camelCase(p.columnName)}Obj(
    @Parent() parent: ${pascalCase(
      tableItem.tableName
    )}, // Resolved object that implements Character
    // @Info() { info }, // Type of the object that implements Character
  ) {
    if (!parent.${camelCase(p.columnName)}) {
      return undefined;
    }
    // Get character's friends
    return this.${camelCase(p.referencedTableName)}Service.findByPk(parent.${camelCase(
          p.columnName
        )});
  }
${hasManyTemp}`;
      } else {
        if (p.referencedTableName !== p.tableName) {
          const fileName = p.tableName.replace(/_/g, '-');
          // import { LittleBeeUser } from 'src/little-bee-user/entities/little-bee-user.entity';
          // import { LittleBeeUserService } from 'src/little-bee-user/little-bee-user.service';
          txtImport.add(
            `import { ${pascalCase(
              p.tableName
            )} } from 'src/${fileName}/entities/${fileName}.entity';`
          );
          txtImport.add(
            `import { ${pascalCase(
              p.tableName
            )}Service } from 'src/${fileName}/${fileName}.service';`
          );
          injectService.add(`private readonly ${camelCase(p.tableName)}Service: ${pascalCase(
            p.tableName
          )}Service
`);
        }

        // 主表 主键 Hasmany
        return `
  @ResolveField(() => [${pascalCase(p.tableName)}${inputCol}], { nullable: true })
  async  ${camelCase(p.tableName)}${pascalCase(p.columnName)}(
    @Parent() parent: ${pascalCase(
      tableItem.tableName
    )}, // Resolved object that implements Character
    @Info() { info }, // Type of the object that implements Character
    @Args('param', { type: () => FindAllInput, nullable: true })
    param: FindAllInput,
  ) {
    if (!parent.id) {
      return undefined;
    }
    // Get character's friends
    return this.${camelCase(p.tableName)}Service.findAll({
      ...param,
      where: {
        ${camelCase(p.columnName)}: parent.id,
        ...param?.where,
      },
    });
  }
  `;
      }
    })
    .join(``);
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
  const infoImport = filedResolver ? ', Info' : '';
  const resolveFieldImport = filedResolver ? ', Parent, ResolveField' : '';
  return `import { Resolver, Query, Mutation, Args${infoImport}${resolveFieldImport} } from '@nestjs/graphql';
import { ${className}Service } from './${modelFileName}.service';
import { ${className} } from './entities/${modelFileName}.entity';
import { Create${className}Input } from './dto/create-${modelFileName}.input';
import { Update${className}Input } from './dto/update-${modelFileName}.input';
import { Save${className}Input } from './dto/save-${modelFileName}.input';
import { FindAllInput } from 'src/utils/common.input';
import { UseGuards } from '@nestjs/common';
import { GqlAuthGuard } from 'src/auth/gql-auth.guard';
import { CurrentUser } from 'src/auth/current-user';
import { JwtAuthEntity } from 'src/auth/jwt-auth-entity';
import { SaveIncludeInput } from 'src/user/dto/save-include.input';
${importFiled}

@Resolver(() => ${className})
export class ${className}Resolver {
  constructor(private readonly ${funName}Service: ${className}Service,${injectService}) {}

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ${className})
  save${className}(
    @Args('save${className}Input') save${className}Input: Save${className}Input,
    @Args('saveIncludeInput', { type: () => [SaveIncludeInput], nullable: true })
    saveIncludeInput: Array<SaveIncludeInput>,
    @CurrentUser() user: JwtAuthEntity,
  ) {
    return this.${funName}Service.save(save${className}Input, user, saveIncludeInput);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ${className})
  create${className}(
    @Args('create${className}Input') create${className}Input: Create${className}Input,
    @CurrentUser() user: JwtAuthEntity,
  ) {
    return this.${funName}Service.create(create${className}Input,user);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => [${className}], { name: '${className}All' })
  findAll(@Args('param') param: FindAllInput,
    @CurrentUser() user: JwtAuthEntity,) {
    return this.${funName}Service.findAll(param, user);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => Number, { name: '${className}Count' })
  findCount(
    @Args('param') param: FindAllInput,
    @CurrentUser() user: JwtAuthEntity,
  ) {
    return this.${funName}Service.findCount(param, user);
  }

  @UseGuards(GqlAuthGuard)
  @Query(() => ${className}, { name: '${className}' })
  findOne(@Args('id', { type: () => String }) id: string,
    @CurrentUser() user: JwtAuthEntity,) {
    return this.${funName}Service.findByPk(id, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => ${className})
  update${className}(
    @Args('update${className}Input') update${className}Input: Update${className}Input,
    @CurrentUser() user: JwtAuthEntity,
  ) {
    return this.${funName}Service.update(update${className}Input.id, update${className}Input, user);
  }

  @UseGuards(GqlAuthGuard)
  @Mutation(() => String)
  remove${className}(@Args('id', { type: () => String }) id: string,
    @CurrentUser() user: JwtAuthEntity,) {
    return this.${funName}Service.remove(id, user);
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
    injectService: Array.from(injectService).join(','),
  });
};
