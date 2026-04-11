import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { SupabaseAuthGuard } from "../../common/guards/supabase-auth.guard";
import { CreatePostDto } from "./dto/create-post.dto";
import { ListPostsDto } from "./dto/list-posts.dto";
import { PostOrganizationActionDto } from "./dto/post-organization-action.dto";
import { SchedulePostDto } from "./dto/schedule-post.dto";
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

  @Post(":id/schedule")
  async schedule(@CurrentUser() user: { id: string }, @Param("id") postId: string, @Body() dto: SchedulePostDto) {
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
}
