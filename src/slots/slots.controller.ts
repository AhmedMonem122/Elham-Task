import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { SlotsService } from './slots.service.js';

@ApiTags('Slots')
@Controller('slots')
export class SlotsController {
  constructor(private readonly slots: SlotsService) {}

  @Get()
  @ApiOperation({
    summary: 'List available slots',
    description:
      'Returns slots with no active booking, ordered by startsAt then id ascending. ' +
      'No query params, no body, no auth. Empty result is `{"slots":[]}`.',
  })
  @ApiOkResponse({
    description: 'Available slots (possibly empty).',
    schema: {
      type: 'object',
      required: ['slots'],
      properties: {
        slots: {
          type: 'array',
          items: {
            type: 'object',
            required: ['id', 'startsAt', 'endsAt'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                example: '11111111-1111-4111-8111-111111111111',
              },
              startsAt: {
                type: 'string',
                format: 'date-time',
                example: '2030-01-15T09:00:00.000Z',
              },
              endsAt: {
                type: 'string',
                format: 'date-time',
                example: '2030-01-15T09:30:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  async list() {
    const slots = await this.slots.listAvailable();
    return { slots };
  }
}
