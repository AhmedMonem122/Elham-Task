import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

/**
 * POST /bookings body. All fields required.
 * Name/email are trimmed BEFORE validation and storage
 * (so "  Alex  " passes and is stored as "Alex").
 */
export class CreateBookingDto {
  @ApiProperty({
    description: 'Target slot id (must exist and have no active booking).',
    format: 'uuid',
    example: '11111111-1111-4111-8111-111111111111',
  })
  @IsUUID('all', { message: 'slotId must be a valid UUID.' })
  slotId!: string;

  @ApiProperty({ description: 'Customer name (trimmed, non-empty).', example: 'Alex Morgan' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'customerName must be a string.' })
  @IsNotEmpty({ message: 'customerName must not be empty.' })
  @MaxLength(200, { message: 'customerName is too long.' })
  customerName!: string;

  @ApiProperty({
    description: 'Customer email (trimmed, valid email).',
    example: 'alex@example.com',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'customerEmail must be a string.' })
  @IsEmail({}, { message: 'customerEmail must be a valid email address.' })
  @MaxLength(320, { message: 'customerEmail is too long.' })
  customerEmail!: string;
}
