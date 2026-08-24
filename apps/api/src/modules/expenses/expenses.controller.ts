import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpensesService } from './expenses.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { TenantOrgGuard } from '../../common/guards/tenant-org.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import {
  Permission,
  ApiResponse,
  ExpenseCategoryDto,
  ExpenseRecordDto,
  ExpenseSummaryDto,
} from '@propertyos/types';
import {
  createExpenseSchema,
  updateExpenseSchema,
  expenseFilterSchema,
  CreateExpenseInput,
  UpdateExpenseInput,
  ExpenseFilterInput,
} from '@propertyos/validation';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

@Controller('expenses')
@UseGuards(AuthGuard, TenantOrgGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  @RequirePermissions(Permission.EXPENSE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  async createExpense(
    @Req() req: any,
    @Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput
  ): Promise<ApiResponse<ExpenseRecordDto>> {
    const data = await this.expensesService.createExpense(
      req.organizationId,
      body,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Get()
  @RequirePermissions(Permission.EXPENSE_READ)
  async getExpenses(
    @Req() req: any,
    @Query(new ZodValidationPipe(expenseFilterSchema)) query: ExpenseFilterInput
  ): Promise<ApiResponse<ExpenseRecordDto[]>> {
    const result = await this.expensesService.getExpenses(req.organizationId, query);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
    };
  }

  @Get('summary')
  @RequirePermissions(Permission.EXPENSE_READ)
  async getSummary(
    @Req() req: any,
    @Query('propertyId') propertyId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ): Promise<ApiResponse<ExpenseSummaryDto>> {
    const data = await this.expensesService.getSummary(
      req.organizationId,
      propertyId,
      startDate,
      endDate
    );
    return {
      success: true,
      data,
    };
  }

  @Get('categories')
  @RequirePermissions(Permission.EXPENSE_READ)
  async getCategories(): Promise<ApiResponse<ExpenseCategoryDto[]>> {
    const data = await this.expensesService.getCategories();
    return {
      success: true,
      data,
    };
  }

  @Post('upload-receipt')
  @RequirePermissions(Permission.EXPENSE_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async uploadReceipt(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('propertyId') propertyId: string
  ): Promise<ApiResponse<{ fileUrl: string; fileName: string }>> {
    if (!file) {
      throw new BadRequestException('No receipt file provided');
    }
    if (!propertyId) {
      throw new BadRequestException('propertyId is required for receipt upload');
    }

    const data = await this.expensesService.uploadReceipt(
      req.organizationId,
      propertyId,
      file,
      req.user?.id
    );

    return {
      success: true,
      data,
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.EXPENSE_READ)
  async getExpenseById(
    @Req() req: any,
    @Param('id') id: string
  ): Promise<ApiResponse<ExpenseRecordDto>> {
    const data = await this.expensesService.getExpenseById(req.organizationId, id);
    return {
      success: true,
      data,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.EXPENSE_UPDATE)
  async updateExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateExpenseSchema)) body: UpdateExpenseInput
  ): Promise<ApiResponse<ExpenseRecordDto>> {
    const data = await this.expensesService.updateExpense(
      req.organizationId,
      id,
      body,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.EXPENSE_DELETE)
  async deleteExpense(
    @Req() req: any,
    @Param('id') id: string
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    const data = await this.expensesService.deleteExpense(
      req.organizationId,
      id,
      req.user?.id
    );
    return {
      success: true,
      data,
    };
  }
}
