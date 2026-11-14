# NestJS Worked Example

A complete `surveyBuilder` module. File names below use the common NestJS `kebab.type.ts` style; if the project uses a different file naming convention, follow the project.

```
src/modules/surveyBuilder/
├── surveyBuilder.module.ts
├── controllers/survey.controller.ts
├── services/survey.service.ts
├── repositories/survey.repository.ts
├── entities/survey.entity.ts
├── dtos/create-survey.dto.ts
├── dtos/survey.dto.ts
├── enums/survey-status.enum.ts
└── utils/fractionalIndexUtil.ts
```

## Enum

```ts
export enum SurveyStatusEnum {
  ACTIVE = 'ACTIVE',
  ARCHIVED = 'ARCHIVED',
}
```

## Entity

Explicit column name, type, length, nullability and default.

```ts
@Entity({ name: 'survey' })
export class SurveyEntity extends BaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', type: 'varchar', length: 30, nullable: true })
  name: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: SurveyStatusEnum,
    default: SurveyStatusEnum.ACTIVE,
    nullable: false,
  })
  status: SurveyStatusEnum;
}
```

## Repository

All queries live here. If the project uses a different repository pattern (e.g. extending `Repository<T>` via `DataSource`), follow it.

```ts
@Injectable()
export class SurveyRepository {
  constructor(
    @InjectRepository(SurveyEntity)
    private readonly repository: Repository<SurveyEntity>,
  ) {}

  findAll(): Promise<SurveyEntity[]> {
    return this.repository.find();
  }

  save(survey: SurveyEntity): Promise<SurveyEntity> {
    return this.repository.save(survey);
  }
}
```

## DTOs

Request DTO with validation, including nested objects:

```ts
export class CreateSurveyDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionDto)
  questions: CreateQuestionDto[];
}
```

Response DTO exposing only what the consumer needs:

```ts
export class SurveyDto {
  id: number;
  name: string | null;
  status: SurveyStatusEnum;
}
```

## Service

Business rules + mapping. Constructor injection, `private readonly`, no HTTP concerns.

```ts
@Injectable()
export class SurveyService {
  constructor(
    private readonly surveyRepository: SurveyRepository,
  ) {}

  async findAll(): Promise<SurveyDto[]> {
    const surveys = await this.surveyRepository.findAll();

    return surveys
      .filter(survey => survey.status === SurveyStatusEnum.ACTIVE)
      .map(survey => this.toDto(survey));
  }

  private toDto(survey: SurveyEntity): SurveyDto {
    return { id: survey.id, name: survey.name, status: survey.status };
  }
}
```

## Controller

Thin: route, validate, delegate, return DTO.

```ts
@Controller('surveys')
export class SurveyController {
  constructor(
    private readonly surveyService: SurveyService,
  ) {}

  @Get()
  findAll(): Promise<SurveyDto[]> {
    return this.surveyService.findAll();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSurveyDto): Promise<SurveyDto> {
    return this.surveyService.create(dto);
  }
}
```

**Violation — never do this:**

```ts
@Controller('surveys')
export class SurveyController {
  constructor(private readonly surveyRepository: SurveyRepository) {} // ❌ repository in controller

  @Get()
  async findAll(): Promise<SurveyEntity[]> {                           // ❌ returns entity
    const surveys = await this.surveyRepository.findAll();
    return surveys.filter(s => s.status === SurveyStatusEnum.ACTIVE);  // ❌ business logic
  }
}
```

## Utility

One cohesive file, one named `const` export.

```ts
const generateOrderNumForInsertionAt = (before: string | null, after: string | null): string => {
  // ...
};

const generateOrderNumbers = (count: number): string[] => {
  // ...
};

export const fractionalIndexUtil = {
  generateOrderNumForInsertionAt,
  generateOrderNumbers,
} as const;
```

## Module registration

Export **services only** — this is what enforces the cross-module boundary.

```ts
@Module({
  imports: [TypeOrmModule.forFeature([SurveyEntity])],
  controllers: [SurveyController],
  providers: [SurveyService, SurveyRepository],
  exports: [SurveyService], // ✅ never export SurveyRepository
})
export class SurveyBuilderModule {}
```

Another module that needs survey data imports `SurveyBuilderModule` and injects `SurveyService`.