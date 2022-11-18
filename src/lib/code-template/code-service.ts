import { ISend } from '../code-generator';
import { pascalCase } from '../utils/helper';

const modelTemplate = ({
  className,
  modelFileName,
}: {
  className: string;
  modelFileName: string;
}) => {
  return `import { Provide } from '@midwayjs/decorator';
import ServiceGenericBase from '../lib/base/service-generic.base';
import { ${className}Entity } from '../lib/model/${modelFileName}.entity';

@Provide()
export class ${className}Service extends ServiceGenericBase<${className}Entity> {
  get Entity() {
    return ${className}Entity;
  }
}
`;
};

export const send = ({ tableItem }: ISend) => {
  return modelTemplate({
    className: pascalCase(tableItem.tableName),
    modelFileName: tableItem.tableName.replace(/_/g, '-'),
  });
};
