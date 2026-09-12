import { ApiProperty } from '@nestjs/swagger';

/** Mirrors `SessionUser` - the fields the session guard loads and nothing more. */
export class SessionUserDto {
  @ApiProperty({
    description: "The user's id, as stored by Auth.js.",
    example: 'cmf3k9x2b0000v8mc4h7q1abc',
  })
  id!: string;

  @ApiProperty({
    description: 'Null for an account that never carried one.',
    example: 'traveller@example.com',
    nullable: true,
    type: String,
  })
  email!: string | null;

  @ApiProperty({
    description: 'Display name from the identity provider.',
    example: 'Alex Traveller',
    nullable: true,
    type: String,
  })
  name!: string | null;
}
