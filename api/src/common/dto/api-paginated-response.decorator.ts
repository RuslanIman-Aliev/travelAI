import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';
import { PaginationMetaDto } from './pagination-meta.dto';

/**
 * Describes a `{ items, pagination }` response for any item type.
 *
 * A generic class cannot be handed to `@ApiOkResponse` - type arguments are gone
 * by the time decorators run - so the shape is written out here and the item
 * model is referenced by `getSchemaPath`. `@ApiExtraModels` is what puts that
 * model in the document at all: nothing else mentions it by type, so without it
 * the `$ref` would dangle.
 *
 * @param {Type<unknown>} model - The item class carried by the page.
 * @param {string} key - Property the items are under, e.g. `trips`.
 * @param {string} description - Text for the 200 response.
 * @returns {MethodDecorator & ClassDecorator} The combined decorators.
 */
export const ApiPaginatedResponse = (
  model: Type<unknown>,
  key: string,
  description: string,
) =>
  applyDecorators(
    ApiExtraModels(model, PaginationMetaDto),
    ApiOkResponse({
      description,
      schema: {
        type: 'object',
        required: [key, 'pagination'],
        properties: {
          [key]: {
            type: 'array',
            items: { $ref: getSchemaPath(model) },
          },
          pagination: { $ref: getSchemaPath(PaginationMetaDto) },
        },
      },
    }),
  );
