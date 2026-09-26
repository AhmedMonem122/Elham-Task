import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { BookingsService } from './bookings.service.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { BookingEnvelopeDto } from './dto/booking-response.dto.js';

const ERROR_SCHEMA = {
  type: 'object',
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      required: ['code', 'message'],
      properties: {
        code: { type: 'string', example: 'SLOT_UNAVAILABLE' },
        message: {
          type: 'string',
          example: 'This slot already has an active booking.',
        },
      },
    },
  },
};

@ApiTags('Bookings')
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a booking',
    description:
      'Books an available slot. Exactly one of two concurrent valid requests ' +
      'for the same slot wins with 201; the loser gets 409 SLOT_UNAVAILABLE. ' +
      'Name/email are trimmed before validation/storage. No auth.',
  })
  @ApiBody({
    type: CreateBookingDto,
    examples: {
      default: {
        value: {
          slotId: '11111111-1111-4111-8111-111111111111',
          customerName: 'Alex Morgan',
          customerEmail: 'alex@example.com',
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Booking created.',
    type: BookingEnvelopeDto,
  })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR — bad input or malformed JSON.', schema: ERROR_SCHEMA })
  @ApiNotFoundResponse({ description: 'SLOT_NOT_FOUND — valid UUID, unknown slot.', schema: ERROR_SCHEMA })
  @ApiConflictResponse({ description: 'SLOT_UNAVAILABLE — slot already actively booked.', schema: ERROR_SCHEMA })
  async create(@Body() dto: CreateBookingDto) {
    const booking = await this.bookings.create(
      dto.slotId,
      dto.customerName,
      dto.customerEmail,
    );
    return { booking };
  }

  @Delete(':bookingId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a booking',
    description:
      'Active -> cancelled and the slot becomes bookable again. ' +
      'Repeat-cancel of an already-cancelled booking returns 200 with the ' +
      'unchanged row and emits NO new event. Cancelling an old booking never ' +
      'affects a newer active booking on the same slot. No auth, no body.',
  })
  @ApiParam({
    name: 'bookingId',
    format: 'uuid',
    required: true,
    description: 'Booking id (UUID).',
    example: '22222222-2222-4222-8222-222222222222',
  })
  @ApiOkResponse({ description: 'Cancelled (or already-cancelled) booking.', type: BookingEnvelopeDto })
  @ApiBadRequestResponse({ description: 'VALIDATION_ERROR — bookingId is not a UUID.', schema: ERROR_SCHEMA })
  @ApiNotFoundResponse({ description: 'BOOKING_NOT_FOUND — valid UUID, unknown booking.', schema: ERROR_SCHEMA })
  async cancel(
    // Any UUID version accepted: only malformed ids -> 400 VALIDATION_ERROR
    // (via ParseUUIDPipe -> global filter); well-formed unknown ids -> 404.
    @Param('bookingId', new ParseUUIDPipe()) bookingId: string,
  ) {
    const booking = await this.bookings.cancel(bookingId);
    return { booking };
  }
}
