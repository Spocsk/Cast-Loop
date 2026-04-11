import { BadRequestException } from "@nestjs/common";
import { PostsService } from "../src/modules/posts/posts.service";

describe("PostsService scheduling guards", () => {
  it("requires at least one target account", async () => {
    const service = new PostsService(
      {
        query: jest.fn().mockResolvedValue([])
      } as never,
      {
        assertMembership: jest.fn()
      } as never,
      {
        record: jest.fn()
      } as never
    );

    await expect(
      service.create("user-1", {
        organizationId: "8fe2d17d-b0f0-4f87-8f30-e10d2da3521e",
        title: "Post",
        content: "Test",
        targetSocialAccountIds: []
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
