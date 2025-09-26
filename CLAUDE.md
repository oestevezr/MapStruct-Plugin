# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension called "MapStruct Generator" that helps Java developers automatically generate MapStruct mappers from DTO (Data Transfer Object) and DAO (Data Access Object) classes. The extension provides an intelligent, automated approach to field extraction and an advanced visual interface for mapping fields between different Java classes.

### Key Features
- **Automatic Project Detection**: Finds `business.vN` folders automatically
- **Smart Field Extraction**: Extracts DTO fields from `dto/` folder and DAO fields with `@Campo` annotation from `dao/model/` subfolders
- **Advanced Visual Mapping Interface**: Interactive UI with connection-based field mapping, search/filter capabilities, and auto-mapping
- **Multi-folder Support**: Handles multiple model subfolders with user selection

## Development Commands

- **Build**: `npm run compile` - Compiles TypeScript to JavaScript in the `out/` directory
- **Watch mode**: `npm run watch` - Compiles in watch mode for development
- **Lint**: `npm run lint` - Runs ESLint on the `src/` directory
- **Test**: `npm run test` - Runs tests using vscode-test
- **Pre-test**: `npm run pretest` - Runs compile and lint before tests
- **Package**: `npm run vscode:prepublish` - Prepares extension for publishing

## Architecture

### Extension Structure
- **Main entry**: `src/extension.ts` - Contains the extension activation logic and main command handler
- **Test suite**: `src/test/extension.test.ts` - Basic test setup
- **Output**: Compiled JavaScript goes to `out/extension.js`

### Core Components

1. **Automated Project Detection** (`src/extension.ts:32-51`):
   - `findBusinessFolder()` automatically locates `business.vN` folders in the workspace
   - Uses regex pattern `/^business\.v\d+$/i` to match version folders

2. **Smart Field Extraction**:
   - **DTO Extraction** (`extractDtoFields()` at line 96): Processes all `.java` files in `business.vN/dto/` folder
   - **DAO Extraction** (`extractDaoFields()` at line 148): Processes files in `business.vN/dao/model/[subfolder]/` with `@Campo` annotation filtering
   - **Multi-folder Support** (`getModelSubfolders()` at line 129): Detects multiple model subfolders and prompts user selection

3. **Enhanced Java Class Parser** (`parseJavaClass()` at line 61):
   - Supports both regular field extraction and `@Campo` annotation filtering
   - Captures field type, name, and className for grouping
   - Handles private/public/protected fields with various modifiers

4. **Advanced Interactive Webview** (`createEnhancedMappingWebview()` at line 253):
   - **Connection-based Mapping**: Click-to-connect interface between DTO and DAO fields
   - **Accordion Grouping**: DTO fields organized by class with expand/collapse functionality
   - **Search & Filter**: Real-time filtering for both DTO and DAO fields
   - **Auto-mapping**: Automatic matching of fields with identical names
   - **Visual Feedback**: Connection indicators, stats, and progress tracking

5. **Automated Workflow**:
   - Automatically detects `business.vN` folder structure
   - Extracts all DTO fields from `dto/` folder (grouped by class)
   - Prompts user to select model subfolder if multiple exist
   - Extracts DAO fields with `@Campo` annotation filtering
   - Excludes Request/Response classes from DAO analysis
   - Presents enhanced visual mapping interface
   - TODO: Integration with FastAPI/Gemini API for MapStruct code generation

### TypeScript Configuration
- Target: ES2022
- Module: Node16
- Strict mode enabled
- Output directory: `out/`

### Dependencies
- **Runtime**: `@vscode/webview-ui-toolkit` for UI components
- **Development**: Standard VS Code extension toolkit with TypeScript, ESLint, and testing frameworks

### Data Structures

The extension uses several key interfaces:

```typescript
interface JavaField {
    name: string;
    type: string;
    className: string; // For grouping fields by their source class
}

interface GroupedFields {
    [className: string]: JavaField[]; // DTO fields organized by class
}

interface ProjectStructure {
    businessFolder: string;
    dtoFields: GroupedFields;
    daoFields: JavaField[];
}
```

### Expected Project Structure

The extension expects Java projects with this structure:
```
project-root/
├── business.v1/ (or business.v2, etc.)
│   ├── dto/
│   │   ├── UserDTO.java
│   │   ├── ProductDTO.java
│   │   └── ...
│   └── dao/
│       └── model/
│           ├── subfolder1/
│           │   ├── User.java (@Campo annotations)
│           │   └── Product.java
│           └── subfolder2/
│               └── ...
```

### Current Limitations
- MapStruct code generation API integration is not yet implemented (TODO at lines 275-277)
- Visual connection lines between mapped fields are planned but not fully implemented
- The extension assumes Spanish language for some UI elements