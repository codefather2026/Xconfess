import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category, CategoryIcon } from '../entities/category.entity';
import { CreateCategoryDto, UpdateCategoryDto } from '../dto/create-category.dto';
import { slugify } from '../../common/utils/slugify';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(includeInactive = false): Promise<Category[]> {
    const qb = this.categoryRepository.createQueryBuilder('category').orderBy('category.name', 'ASC');
    if (!includeInactive) {
      qb.where('category.isActive = :isActive', { isActive: true });
    }
    return qb.getMany();
  }

  async findOne(id: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepository.findOne({ where: { slug } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    const slug = dto.slug?.trim() || slugify(dto.name);
    const existing = await this.categoryRepository.findOne({ where: { slug } });
    if (existing) {
      throw new ConflictException('A category with this slug already exists');
    }

    const category = this.categoryRepository.create({
      name: dto.name.trim(),
      slug,
      icon: dto.icon || CategoryIcon.OTHER,
      color: dto.color || '#6366f1',
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
      confessionCount: 0,
    });

    return this.categoryRepository.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findOne(id);

    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.slug !== undefined) {
      const slug = dto.slug.trim();
      const existing = await this.categoryRepository.findOne({ where: { slug } });
      if (existing && existing.id !== id) {
        throw new ConflictException('A category with this slug already exists');
      }
      category.slug = slug;
    }
    if (dto.icon !== undefined) {
      category.icon = dto.icon;
    }
    if (dto.color !== undefined) {
      category.color = dto.color;
    }
    if (dto.description !== undefined) {
      category.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      category.isActive = dto.isActive;
    }

    return this.categoryRepository.save(category);
  }

  async remove(id: string): Promise<void> {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
  }
}
