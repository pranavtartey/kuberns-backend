import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { WebAppsService } from './webapps.service';
import { CreateWebAppDto } from '../../dtos/create-webapp.dto';

const DUMMY_USER_ID = 1;

@Controller('webapps')
@ApiTags('webapps')
export class WebAppsController {
  constructor(private readonly webAppsService: WebAppsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a WebApp with environments and instances' })
  create(@Body() dto: CreateWebAppDto) {
    return this.webAppsService.create(dto, DUMMY_USER_ID);
  }

  @Get()
  @ApiOperation({ summary: 'List all WebApps' })
  findAll() {
    return this.webAppsService.findAll(DUMMY_USER_ID);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get WebApp details' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.webAppsService.findOne(id, DUMMY_USER_ID);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Poll deployment status and logs' })
  getDeploymentStatus(@Param('id', ParseIntPipe) id: number) {
    return this.webAppsService.getDeploymentStatus(id, DUMMY_USER_ID);
  }
}
