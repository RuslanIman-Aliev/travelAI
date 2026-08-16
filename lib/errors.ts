/**
 * An error whose message was written for the end user and is safe to display.
 *
 * `formatError` surfaces these verbatim and replaces everything else with a
 * generic string, so the distinction has to be explicit: "Unauthorized" should
 * reach the user, while a Prisma connection failure should not.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}
