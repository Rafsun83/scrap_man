---
name: nestjs-backend-standards
description: NestJS/TypeScript backend code organization standards — feature modules under src/modules/ (camelCase), thin controllers, services for business logic, repositories for data access, DTO/entity/utils/enums/types conventions, and cross-module boundaries. Use this skill whenever implementing a new NestJS feature, endpoint, API, module, controller, service, repository, entity, DTO, enum, type or utility; when adding or moving files under src/modules/; when refactoring NestJS backend code; or when reviewing it for structure. Apply it even when the user only says "add an API for X" or "implement this feature" without mentioning standards or structure.
---

# NestJS Backend Code Organization Standards

Every backend change must fit the feature-module structure below. The goal: anyone can open `src/modules/<feature>/` and find everything for that feature in a predictable place, and no business rule can be bypassed through a side door (a controller hitting a repository, or one module reaching into another's data).

Before writing code, read `references/examples.md`. It has a complete worked module showing every layer.

## Workflow for a new feature

1. **Inspect the project first.** Open one or two existing modules and learn the conventions this standard defers to: file naming (`survey.service.ts` vs `SurveyService.ts`), repository naming (`SurveyRepository` vs `SurveyEntityRepository`), TypeORM repository pattern, base entity class, and module file naming. Match what exists.
2. **Pick the owning module.** If an existing module owns this domain concept, add to it. Create a new module only for a genuinely separate feature or responsibility.
3. **Name a new module** with a camelCase directory that describes the feature: `surveyBuilder`, `surveyDraftToEntity`, `redis`. Never use `common`, `misc`, `helpers` or `shared` as a grab-bag for unrelated code.
4. **Create only the directories the feature needs.** No empty folders. No `application/`, `domain/`, `infrastructure/` or similar layer directories.
5. **Implement bottom-up:** enums → entity → repository → DTOs → service → controller → `@Module` registration.
6. **Check cross-module access** using the section below.
7. **Run the final checklist** before reporting the work as done.

## Module layout

```
src/modules/surveyBuilder/
├── surveyBuilder.module.ts
├── controllers/
├── services/
├── repositories/
├── entities/
├── dtos/
├── enums/
├── utils/
└── types/
```

| Directory | Holds | Never holds |
|---|---|---|
| `controllers/` | Routes, request validation, HTTP status, response shaping | Business logic, repository calls, queries |
| `services/` | Business rules, workflows, orchestration, entity→DTO mapping | Routes, HTTP status handling, raw queries |
| `repositories/` | Queries, persistence, DB-specific operations | Workflows, business rules |
| `entities/` | TypeORM-mapped persistence classes | Business workflows |
| `dtos/` | Request/response contracts + class-validator rules | Business logic |
| `enums/` | Feature-specific enumerations | — |
| `utils/` | Cohesive, feature-specific helper groups | Generic dumping-ground helpers |
| `types/` | Interfaces and type aliases shared by 2+ files | One-off trivial types |

## Layer rules

### Controllers (`controllers/`)
- Suffix: `Controller`, as in `SurveyController`.
- Inject **services only**. A repository in a controller constructor is a violation.
- Do: routes, input validation, HTTP concerns, status codes, return DTOs.
- Don't: filter, compute, branch on business rules, or query the database.

### Services (`services/`)
- Suffix: `Service`, as in `SurveyService`. Lives directly in `services/`.
- Constructor injection only, with every dependency `private readonly`.
- Owns business rules, data transformation, and coordination of repositories.
- No HTTP concerns: no `@HttpCode`, no `HttpStatus` handling, no `Request`/`Response` objects.
- No duplicated query logic. If a query is needed, add it to the repository.
- Don't create a one-to-one service that just wraps repository methods when an existing service in the module can own the operation.

### Repositories (`repositories/`)
- Suffix: `Repository`, following the project's established variant.
- Every database query goes through a repository or the project's established persistence abstraction.
- Used only by services in the same module. Never by controllers, never by other modules.

### DTOs (`dtos/`)
- Suffix: `Dto`, as in `CreateSurveyDto` or `SurveyDto`.
- Data contract only, with no business logic.
- Request DTOs carry class-validator rules. Nested objects use `@ValidateNested()` with `@Type(() => ...)`.
- Response DTOs expose only what the consumer needs. Never return an entity from a public API.

### Entities (`entities/`)
- Follow the project's TypeORM conventions and base entity class.
- In `@Column`, explicitly set `name`, `type`, `length`, `nullable` and `default` where they apply. Declare relationships explicitly.
- Persistence mapping only. One entity per table: don't redefine the same table in another module without a documented reason.

### Utilities (`utils/`)
- Feature-specific and intentionally named: `fractionalIndexUtil.ts`, not `stringUtil.ts`.
- Group cohesive functions in one file.
- Export a single named `const` object with `as const`, unless another export pattern is justified.

### Enums (`enums/`) and types (`types/`)
- Feature enums stay in the owning module's `enums/`.
- Put interfaces and type aliases in `types/` only when they are shared across files. Keep one-off trivial types inline.

## Cross-module dependencies

- A module owns its business logic and data access.
- Other modules use the owning module's **service** or an explicitly defined public contract, never its repository.
- Enforce this in `@Module`: list only services in `exports`, never repositories.
- No circular dependencies, and no `forwardRef()` used to paper over one. If two modules need each other, the boundary is wrong, so move or extract the shared concept.
- Extract a shared module only when code is **actually** used by multiple modules today, not in anticipation.

## Existing code that violates the standard

Apply the standard to everything you add or change. When nearby existing code violates it, don't refactor it unasked. Mention the violation to the user and offer a follow-up. Never copy a violation just because the surrounding code does it.

## Final checklist

Before reporting a feature as done, confirm each item:

- [ ] Code lives in the correct module under `src/modules/` with a camelCase directory name
- [ ] Only needed directories exist; no layer directories, no empty folders
- [ ] Every class has the right suffix: `Controller`, `Service`, `Repository`, `Dto`
- [ ] Controllers inject only services and contain no business logic or queries
- [ ] Services use constructor injection with `private readonly` dependencies and have no HTTP concerns
- [ ] All queries are in repositories; repositories are used only by services in the same module
- [ ] Public APIs return DTOs, not entities; request DTOs are validated, including nested objects
- [ ] Entity `@Column`s explicitly declare name, type, length, nullability and defaults where they apply
- [ ] Utilities are feature-specific, cohesive, and exported as a single named `const` object
- [ ] `@Module` exports only services; no cross-module repository access, no circular dependencies, no premature shared code