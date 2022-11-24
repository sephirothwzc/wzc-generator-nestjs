import { ISend } from '../code-generator';
import { pascalCase } from '../utils/helper';

const modelTemplate = ({
  className,
  modelFileName,
}: {
  className: string;
  modelFileName: string;
}) => {
  return `import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { ${className}Model } from 'src/model/customer/${modelFileName}.model';
import { IBaseService } from 'src/utils/base-service';

@Injectable()
export class ${className}Service extends IBaseService<${className}Model> {
  constructor(
    @InjectModel(${className}Model)
    private model: typeof ${className}Model,
  ) {
    super();
  }
  get GetModel() {
    return this.model;
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
