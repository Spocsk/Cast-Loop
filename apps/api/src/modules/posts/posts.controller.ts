import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CreatePostDto } from "./dto/create-post.dto";
import { ImportPostsDto } from "./dto/import-posts.dto";
import { ListPostsDto } from "./dto/list-posts.dto";
import { PostOrganizationActionDto } from "./dto/post-organization-action.dto";
import { SchedulePostDto } from "./dto/schedule-post.dto";
import { UpdatePostDto } from "./dto/update-post.dto";
import { PostsService } from "./posts.service";

@Controller("posts")
@UseGuards(SupabaseAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }, @Query() query: ListPostsDto) {
    return this.postsService.list(user.id, query);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreatePostDto) {
    return this.postsService.create(user.id, dto);
  }

  @Post("import")
  async importPosts(@CurrentUser() user: { id: string }, @Body() dto: ImportPostsDto) {
    return this.postsService.importPosts(user.id, dto);
  }

  @Patch(":id")
  async update(@CurrentUser() user: { id: string }, @Param("id") postId: string, @Body() dto: UpdatePostDto) {
    return this.postsService.update(user.id, postId, dto);
  }

  @Post(":id/schedule")
  async schedule(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() dto: SchedulePostDto
  ) {
    return this.postsService.schedule(user.id, postId, dto);
  }

  @Post(":id/publish-now")
  async publishNow(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() body: PostOrganizationActionDto
  ) {
    return this.postsService.publishNow(user.id, postId, body.organizationId);
  }

  @Post(":id/cancel")
  async cancel(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() body: PostOrganizationActionDto
  ) {
    return this.postsService.cancel(user.id, postId, body.organizationId);
  }

  @Post(":id/archive")
  async archive(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() body: PostOrganizationActionDto
  ) {
    return this.postsService.archive(user.id, postId, body.organizationId);
  }

  @Post(":id/restore")
  async restore(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() body: PostOrganizationActionDto
  ) {
    return this.postsService.restore(user.id, postId, body.organizationId);
  }

  @Delete(":id")
  async deleteArchived(
    @CurrentUser() user: { id: string },
    @Param("id") postId: string,
    @Body() body: PostOrganizationActionDto
  ) {
    return this.postsService.deleteArchived(user.id, postId, body.organizationId);
  }
}
