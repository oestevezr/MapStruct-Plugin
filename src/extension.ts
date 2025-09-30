import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Proveedor de datos para la vista de la barra lateral de MapStruct
 */
class MapStructSidebarProvider implements vscode.TreeDataProvider<MapStructMenuItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MapStructMenuItem | undefined | null | void> = new vscode.EventEmitter<MapStructMenuItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MapStructMenuItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        console.log('🔧 [DEBUG] MapStructSidebarProvider constructor llamado');
    }

    refresh(): void {
        console.log('🔄 [DEBUG] Refreshing sidebar tree data');
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MapStructMenuItem): vscode.TreeItem {
        console.log(`📋 [DEBUG] getTreeItem llamado para: ${element.label}`);
        return element;
    }

    getChildren(element?: MapStructMenuItem): Thenable<MapStructMenuItem[]> {
        console.log('📋 [DEBUG] getChildren llamado', element ? `para elemento: ${element.label}` : 'para root');

        if (!element) {
            // Root level - show main options
            const items = [
                new MapStructMenuItem(
                    'Mapear desde proyecto',
                    'Analizar estructura del proyecto y generar mapeos',
                    vscode.TreeItemCollapsibleState.None,
                    'mapstruct-generator.mapFromProject',
                    new vscode.ThemeIcon('file-directory')
                ),
                new MapStructMenuItem(
                    'Mapear con Preview URL',
                    'Generar mapeos desde una URL de preview',
                    vscode.TreeItemCollapsibleState.None,
                    'mapstruct-generator.mapFromPreview',
                    new vscode.ThemeIcon('globe'),
                    true
                ),
                new MapStructMenuItem(
                    'Mapear con imágenes',
                    'Generar mapeos desde imágenes (próximamente)',
                    vscode.TreeItemCollapsibleState.None,
                    'mapstruct-generator.mapFromImages',
                    new vscode.ThemeIcon('file-media'),
                    false
                )
            ];
            console.log(`📋 [DEBUG] Retornando ${items.length} elementos del menú`);
            return Promise.resolve(items);
        }
        return Promise.resolve([]);
    }
}

/**
 * Elemento del menú de la barra lateral
 */
class MapStructMenuItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly commandId: string,
        public readonly iconPath?: vscode.ThemeIcon,
        public readonly enabled: boolean = true
    ) {
        super(label, collapsibleState);

        console.log(`🔧 [DEBUG] Creando MapStructMenuItem: ${label}, enabled: ${enabled}, commandId: ${commandId}`);

        this.tooltip = tooltip;
        this.description = enabled ? '' : '(Próximamente)';

        if (commandId && enabled) {
            this.command = {
                command: commandId,
                title: label,
                arguments: []
            };
            console.log(`✅ [DEBUG] Comando asignado: ${commandId}`);
        } else {
            console.log(`⚠️ [DEBUG] Sin comando asignado para: ${label}`);
        }

        if (iconPath) {
            this.iconPath = iconPath;
        }

        if (!enabled) {
            this.contextValue = 'disabled';
        }
    }
}

/**
 * Interfaz para representar un campo de una clase Java.
 */
interface JavaField {
    name: string;
    type: string;
    className: string; // Agregado para agrupar por clase
}

/**
 * Interfaz para representar campos agrupados por clase.
 */
interface GroupedFields {
    [className: string]: JavaField[];
}

/**
 * Interfaz para representar la estructura del proyecto.
 */
interface ProjectStructure {
    businessFolder: string;
    dtoFields: GroupedFields;
    daoFields: JavaField[];
}

/**
 * Encuentra automáticamente la carpeta business.vN en el proyecto Java.
 * Navega por la estructura típica: /src/main/java/.../ hasta encontrar business.vN
 */
async function findBusinessFolder(): Promise<string | null> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('❌ [DEBUG] No se encontraron carpetas de workspace');
        vscode.window.showErrorMessage('No hay carpetas de workspace abiertas');
        return null;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    console.log(`🔍 [DEBUG] Directorio raíz del workspace: ${rootPath}`);

    try {
        // Verificar si existe la estructura src/main/java típica de Maven/Gradle
        const srcPath = path.join(rootPath, 'src');
        const mainPath = path.join(srcPath, 'main', 'java');

        console.log(`🔍 [DEBUG] Verificando estructura Java:`);
        console.log(`  - src/main/java: ${mainPath}`);
        console.log(`  - src: ${srcPath}`);

    let searchPath: string;

        // Si no existe src/main/java, buscar directamente desde la raíz
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(mainPath));
            console.log(`✅ [DEBUG] Encontrada estructura Maven/Gradle: ${mainPath}`);
            searchPath = mainPath;
        } catch {
            console.log(`❌ [DEBUG] No existe src/main/java, verificando src/`);
            // Verificar si al menos existe carpeta 'src'
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(srcPath));
                console.log(`✅ [DEBUG] Encontrada carpeta src: ${srcPath}`);
                searchPath = srcPath;
            } catch {
                console.log(`❌ [DEBUG] No existe src/, buscando desde la raíz: ${rootPath}`);
                searchPath = rootPath;
            }
        }

        console.log(`🎯 [DEBUG] Iniciando búsqueda desde: ${searchPath}`);

        // Función recursiva para buscar la carpeta business.vN
        const searchBusinessFolder = async (currentPath: string, maxDepth: number = 5): Promise<string | null> => {
            if (maxDepth <= 0) {
                console.log(`⚠️ [DEBUG] Límite de profundidad alcanzado en: ${currentPath}`);
                return null;
            }

            console.log(`🔍 [DEBUG] Explorando directorio (profundidad ${5 - maxDepth}): ${currentPath}`);

            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(currentPath));
                console.log(`📁 [DEBUG] Leyendo directorio: ${currentPath}`);

                // Primero, buscar la carpeta "business" en el nivel actual
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory && name.toLowerCase() === 'business') {
                        const businessPath = path.join(currentPath, name);
                        console.log(`🔍 [DEBUG] Carpeta 'business' encontrada en: ${businessPath}`);

                        // Ahora, buscar una subcarpeta "vN" dentro de "business"
                        const versionEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(businessPath));
                        for (const [versionName, versionType] of versionEntries) {
                            if (versionType === vscode.FileType.Directory && /^v\d+$/i.test(versionName)) {
                                const fullVersionPath = path.join(businessPath, versionName);
                                console.log(`🎉 [DEBUG] ¡ENCONTRADO! Ruta completa: ${fullVersionPath}`);
                                return fullVersionPath; // Retornar la ruta completa business/vN
                            }
                        }
                        console.log(`⚠️ [DEBUG] Carpeta 'business' encontrada, pero sin subcarpeta de versión 'vN'.`);
                    }
                }

                // Si no se encontró "business" en este nivel, buscar recursivamente en los subdirectorios
                for (const [name, type] of entries) {
                    if (type === vscode.FileType.Directory && !name.startsWith('.')) {
                        const subPath = path.join(currentPath, name);
                        console.log(`⬇️ [DEBUG] Buscando 'business' en subdirectorio: ${subPath}`);
                        const result = await searchBusinessFolder(subPath, maxDepth - 1);
                        if (result) {
                            return result;
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ [DEBUG] Error explorando directorio ${currentPath}:`, error);
                vscode.window.showWarningMessage(`Error accediendo a directorio: ${currentPath}`);
            }

            console.log(`❌ [DEBUG] No se encontró business.vN en: ${currentPath}`);
            return null;
        };

        const result = await searchBusinessFolder(searchPath);

        if (result) {
            console.log(`🎉 [DEBUG] RESULTADO FINAL: ${result}`);
        } else {
            console.log(`❌ [DEBUG] RESULTADO FINAL: No se encontró ninguna carpeta business.vN`);

            // Mostrar información adicional para debugging
            try {
                const rootEntries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(rootPath));
                const rootDirs = rootEntries.filter(([, type]) => type === vscode.FileType.Directory).map(([name]) => name);
                console.log(`📋 [DEBUG] Directorios en la raíz: ${rootDirs.join(', ')}`);
                vscode.window.showInformationMessage(`Directorios encontrados en la raíz: ${rootDirs.join(', ')}`);
            } catch (error) {
                console.error('Error listando directorios raíz:', error);
            }
        }

        return result;

    } catch (error) {
        console.error('❌ [DEBUG] Error general buscando carpeta business:', error);
        vscode.window.showErrorMessage(`Error durante la búsqueda: ${error}`);
        return null;
    }
}

/**
 * Parsea el contenido de un archivo de clase Java para extraer sus campos.
 * @param fileContent El contenido de la clase como un string.
 * @param className El nombre de la clase.
 * @param filterByCampoAnnotation Si debe filtrar solo campos con @Campo.
 * @returns Un array de objetos JavaField.
 */
function parseJavaClass(fileContent: string, className: string, filterByCampoAnnotation: boolean = false): JavaField[] {
    const fields: JavaField[] = [];

    if (filterByCampoAnnotation) {
        // Regex para campos DAO con anotación @Campo
        const fieldRegex = /@Campo[\s\S]*?(?:private|public|protected)\s+(?:final\s+)?(?:static\s+)?([\w.<>\[\]]+)\s+([\w]+)\s*;/g;

        let match;
        while ((match = fieldRegex.exec(fileContent)) !== null) {
            fields.push({
                type: match[1].trim(),
                name: match[2].trim(),
                className: className
            });
        }
    } else {
        // Regex para campos DTO sin filtro especial
        const fieldRegex = /(?:private|public|protected)\s+(?:final\s+)?(?:static\s+)?([\w.<>\[\]]+)\s+([\w]+)\s*;/g;

        let match;
        while ((match = fieldRegex.exec(fileContent)) !== null) {
            fields.push({
                type: match[1].trim(),
                name: match[2].trim(),
                className: className
            });
        }
    }

    return fields;
}

/**
 * Extrae campos DTO de la carpeta dto/.
 */
async function extractDtoFields(businessPath: string): Promise<GroupedFields> {
    const dtoPath = path.join(businessPath, 'dto');
    const groupedFields: GroupedFields = {};

    try {
        const dtoUri = vscode.Uri.file(dtoPath);
        const entries = await vscode.workspace.fs.readDirectory(dtoUri);

        for (const [fileName, type] of entries) {
            if (type === vscode.FileType.File && fileName.endsWith('.java')) {
                const filePath = path.join(dtoPath, fileName);
                const fileUri = vscode.Uri.file(filePath);
                const fileContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
                const className = fileName.replace('.java', '');

                const fields = parseJavaClass(fileContent, className, false);
                if (fields.length > 0) {
                    groupedFields[className] = fields;
                }
            }
        }

        vscode.window.showInformationMessage('Campos DTO extraídos exitosamente');
    } catch (error) {
        vscode.window.showErrorMessage(`Error extrayendo campos DTO: ${error}`);
    }

    return groupedFields;
}

/**
 * Obtiene las subcarpetas de dao/model/ para selección del usuario.
 */
async function getModelSubfolders(businessPath: string): Promise<string[]> {
    const modelPath = path.join(businessPath, 'dao', 'model');

    try {
        const modelUri = vscode.Uri.file(modelPath);
        const entries = await vscode.workspace.fs.readDirectory(modelUri);

        return entries
            .filter(([name, type]) => type === vscode.FileType.Directory)
            .map(([name]) => name);
    } catch (error) {
        vscode.window.showErrorMessage(`Error accediendo a carpeta dao/model: ${error}`);
        return [];
    }
}

/**
 * Extrae campos DAO de la carpeta dao/model/ seleccionada.
 */
async function extractDaoFields(businessPath: string, selectedFolder: string): Promise<JavaField[]> {
    const modelPath = path.join(businessPath, 'dao', 'model', selectedFolder);
    const fields: JavaField[] = [];

    try {
        const modelUri = vscode.Uri.file(modelPath);
        const entries = await vscode.workspace.fs.readDirectory(modelUri);

        for (const [fileName, type] of entries) {
            if (type === vscode.FileType.File && fileName.endsWith('.java')) {
                // Excluir archivos que empiecen con Request o Response
                if (fileName.startsWith('Request') || fileName.startsWith('Response')) {
                    continue;
                }

                const filePath = path.join(modelPath, fileName);
                const fileUri = vscode.Uri.file(filePath);
                const fileContent = new TextDecoder().decode(await vscode.workspace.fs.readFile(fileUri));
                const className = fileName.replace('.java', '');

                const classFields = parseJavaClass(fileContent, className, true); // Filtrar por @Campo
                fields.push(...classFields);
            }
        }

        vscode.window.showInformationMessage('Campos DAO extraídos exitosamente');
    } catch (error) {
        vscode.window.showErrorMessage(`Error extrayendo campos DAO: ${error}`);
    }

    return fields;
}

/**
 * Función principal que se ejecuta cuando la extensión es activada.
 */
// Global variable to store selected model folder name
let selectedModelFolderName: string = '';

// Function to get the selected model folder name
function getSelectedModelFolderName(): string {
    if (!selectedModelFolderName) {
        console.warn('⚠️ [DEBUG] No model folder name available, using default');
        return 'unknown-model';
    }
    return selectedModelFolderName;
}

export function activate(context: vscode.ExtensionContext) {

    console.log('🚀 [DEBUG] La extensión "mapstruct-generator" está siendo activada...');

    // Crear y registrar el proveedor de la barra lateral
    const sidebarProvider = new MapStructSidebarProvider();
    const treeView = vscode.window.createTreeView('mapstruct-sidebar', {
        treeDataProvider: sidebarProvider,
        showCollapseAll: false
    });

    console.log('📋 [DEBUG] Proveedor de sidebar registrado correctamente');

    // Registrar el TreeView en las suscripciones
    context.subscriptions.push(treeView);

    // Registrar el comando principal (mantener compatibilidad)
    let disposable = vscode.commands.registerCommand('mapstruct-generator.start', async () => {
        console.log('🎯 [DEBUG] Comando start ejecutado');
        await executeMapFromProject();
    });

    // Registrar comando para "Mapear desde proyecto"
    let mapFromProjectDisposable = vscode.commands.registerCommand('mapstruct-generator.mapFromProject', async () => {
        console.log('🎯 [DEBUG] Comando mapFromProject ejecutado desde sidebar');
        await executeMapFromProject();
    });

    // Registrar comando para mostrar menú principal
    let showMainMenuDisposable = vscode.commands.registerCommand('mapstruct-generator.showMainMenu', async () => {
        console.log('🎯 [DEBUG] Comando showMainMenu ejecutado');
        await showMainMenu();
    });

    // Registrar comando para "Mapear con Preview URL"
    let mapFromPreviewDisposable = vscode.commands.registerCommand('mapstruct-generator.mapFromPreview', async () => {
        console.log('🎯 [DEBUG] Comando mapFromPreview ejecutado');
        await executeMapFromPreview();
    });

    let mapFromImagesDisposable = vscode.commands.registerCommand('mapstruct-generator.mapFromImages', async () => {
        console.log('🎯 [DEBUG] Comando mapFromImages ejecutado (placeholder)');
        vscode.window.showInformationMessage('🚧 Funcionalidad en desarrollo: Mapear con imágenes');
    });

    console.log('📋 [DEBUG] Todos los comandos registrados correctamente');

    // Helper function for DAO name validation (Rule 3)
    function validateDaoDirectionality(dtoFieldName: string, daoClassName: string): void {
        // DAO Name Pattern: [4 letters][2 direction letters][2 numbers]
        const daoPattern = /^[A-Z]{4}([A-Z]{2})\d{2}$/;
        const match = daoClassName.match(daoPattern);

        if (!match) {
            // DAO doesn't follow the expected pattern, skip validation
            return;
        }

        const daoDirection = match[1]; // Extract direction letters (CE, FE, EE, CS, FS, SS)
        const inputDirections = ['CE', 'FE', 'EE'];
        const outputDirections = ['CS', 'FS', 'SS'];

        if (dtoFieldName.startsWith('BDtoIn')) {
            if (outputDirections.includes(daoDirection)) {
                console.warn(`⚠️ [DEBUG] Direction mismatch: BDtoIn field "${dtoFieldName}" mapped to output DAO "${daoClassName}" with direction "${daoDirection}"`);
            }
        } else if (dtoFieldName.startsWith('BDtoOut')) {
            if (inputDirections.includes(daoDirection)) {
                console.warn(`⚠️ [DEBUG] Direction mismatch: BDtoOut field "${dtoFieldName}" mapped to input DAO "${daoClassName}" with direction "${daoDirection}"`);
            }
        }
    }

    // Function to create automatic mappings between DTO and DAO fields
    function createAutomaticMappings(dtoFields: GroupedFields, daoFields: JavaField[]): any {
        const input_fields: any[] = [];
        const output_fields: any[] = [];

        console.log('🔍 [DEBUG] Starting automatic mapping process...');
        console.log('📊 [DEBUG] Available DTO classes:', Object.keys(dtoFields));
        console.log('📊 [DEBUG] Total DAO fields:', daoFields.length);

        // Debug: Show all DAO fields
        console.log('🏗️ [DEBUG] Available DAO fields:');
        daoFields.forEach((dao, index) => {
            console.log(`  ${index + 1}. ${dao.name} (${dao.type}) [${dao.className}]`);
        });

        // Iterate through all DTO fields grouped by class
        for (const [dtoClassName, dtosInClass] of Object.entries(dtoFields)) {
            console.log(`📋 [DEBUG] Processing DTO class: ${dtoClassName} with ${dtosInClass.length} fields`);

            dtosInClass.forEach((dtoField, index) => {
                console.log(`  📝 [DEBUG] Processing DTO field ${index + 1}: ${dtoField.name} (${dtoField.type})`);

                // Multiple matching strategies
                let matchingDao = null;

                // Strategy 1: Exact name match (case-insensitive)
                matchingDao = daoFields.find(daoField =>
                    daoField.name.toLowerCase() === dtoField.name.toLowerCase()
                );

                if (!matchingDao) {
                    // Strategy 2: Remove BDtoIn/BDtoOut prefix and match
                    const cleanedDtoName = dtoField.name.replace(/^BDto(In|Out)/, '');
                    matchingDao = daoFields.find(daoField =>
                        daoField.name.toLowerCase() === cleanedDtoName.toLowerCase()
                    );
                    console.log(`    🔄 [DEBUG] Trying cleaned name: ${cleanedDtoName}`);
                }

                if (!matchingDao) {
                    // Strategy 3: Partial match (DAO field contains DTO field or vice versa)
                    const dtoNameLower = dtoField.name.toLowerCase();
                    matchingDao = daoFields.find(daoField => {
                        const daoNameLower = daoField.name.toLowerCase();
                        return daoNameLower.includes(dtoNameLower) || dtoNameLower.includes(daoNameLower);
                    });
                    if (matchingDao) {
                        console.log(`    🎯 [DEBUG] Found partial match: ${matchingDao.name}`);
                    }
                }

                if (!matchingDao) {
                    // Strategy 4: Remove common prefixes/suffixes and try again
                    const cleanedDto = dtoField.name.replace(/^(BDto(In|Out)|dto|Dto|DTO)/, '').replace(/(Field|field)$/, '');
                    matchingDao = daoFields.find(daoField => {
                        const cleanedDao = daoField.name.replace(/^(dao|Dao|DAO)/, '').replace(/(Field|field)$/, '');
                        return cleanedDao.toLowerCase() === cleanedDto.toLowerCase();
                    });
                    if (matchingDao) {
                        console.log(`    🔧 [DEBUG] Found match after cleaning: ${dtoField.name} -> ${matchingDao.name}`);
                    }
                }

                if (matchingDao) {
                    console.log(`    ✅ [DEBUG] Match found: ${dtoField.name} <-> ${matchingDao.name} (${matchingDao.className})`);
                    console.log(`    🏷️ [DEBUG] Format will be set to: "${matchingDao.className}"`);

                    // Apply Rule 3: Validate directionality (non-blocking)
                    validateDaoDirectionality(dtoField.name, matchingDao.className);

                    // Rule 1: Determine source/target based on DTO prefix
                    if (dtoField.name.startsWith('BDtoIn')) {
                        // DTO is source, DAO is target, add to input_fields
                        const inputField = {
                            format: matchingDao.className, // Rule 2: Format is DAO class name
                            field_type: "body", // Default field type
                            source: dtoField.name,
                            target: matchingDao.name
                        };
                        input_fields.push(inputField);
                        console.log(`    📥 [DEBUG] Added to input_fields:`, JSON.stringify(inputField, null, 2));
                    } else if (dtoField.name.startsWith('BDtoOut')) {
                        // DTO is target, DAO is source, add to output_fields
                        const outputField = {
                            format: matchingDao.className, // Rule 2: Format is DAO class name
                            field_type: "body", // Default field type
                            source: matchingDao.name,
                            target: dtoField.name
                        };
                        output_fields.push(outputField);
                        console.log(`    📤 [DEBUG] Added to output_fields:`, JSON.stringify(outputField, null, 2));
                    } else {
                        // Fields without BDtoIn/BDtoOut prefix - treat as input by default
                        const defaultField = {
                            format: matchingDao.className,
                            field_type: "body",
                            source: dtoField.name,
                            target: matchingDao.name
                        };
                        input_fields.push(defaultField);
                        console.log(`    📥 [DEBUG] Added to input_fields (default):`, JSON.stringify(defaultField, null, 2));
                    }
                } else {
                    console.log(`    ❌ [DEBUG] No matching DAO field found for DTO: ${dtoField.name}`);
                }
            });
        }

        console.log(`🎯 [DEBUG] Mapping completed: ${input_fields.length} input fields, ${output_fields.length} output fields`);
        return { input_fields, output_fields };
    }

    // Función que contiene la lógica principal del mapeo desde proyecto
    async function executeMapFromProject() {
        try {
            // 1. Buscar automáticamente la carpeta business.vN
            const businessPath = await findBusinessFolder();
            if (!businessPath) {
                vscode.window.showErrorMessage('No se encontró una carpeta business.vN en el proyecto. Asegúrate de estar en un proyecto Java con la estructura correcta.');
                return;
            }

            vscode.window.showInformationMessage(`Carpeta business encontrada: ${path.basename(businessPath)}`);

            // 2. Extraer campos DTO
            const dtoFields = await extractDtoFields(businessPath);
            if (Object.keys(dtoFields).length === 0) {
                vscode.window.showWarningMessage('No se encontraron campos DTO válidos en la carpeta dto/.');
                return;
            }

            // 3. Obtener subcarpetas del modelo DAO
            const modelSubfolders = await getModelSubfolders(businessPath);
            if (modelSubfolders.length === 0) {
                vscode.window.showErrorMessage('No se encontraron subcarpetas en dao/model/.');
                return;
            }

            // 4. Selección de carpeta de modelo (si hay múltiples)
            let selectedModelFolder: string;
            if (modelSubfolders.length === 1) {
                selectedModelFolder = modelSubfolders[0];
                vscode.window.showInformationMessage(`Analizando carpeta de modelo: ${selectedModelFolder}`);
            } else {
                const selection = await vscode.window.showQuickPick(
                    modelSubfolders.map(folder => ({ label: folder, detail: `Analizar modelo: ${folder}` })),
                    {
                        title: 'Se encontraron varias carpetas de modelos. ¿Cuál deseas analizar?',
                        placeHolder: 'Selecciona una carpeta de modelo'
                    }
                );

                if (!selection) {
                    vscode.window.showInformationMessage('Operación cancelada por el usuario.');
                    return;
                }
                selectedModelFolder = selection.label;
            }

            // Guardar el nombre de la carpeta seleccionada en la variable global
            selectedModelFolderName = selectedModelFolder;
            console.log(`🔗 [DEBUG] Carpeta de modelo seleccionada guardada: ${selectedModelFolderName}`);

            // 5. Extraer campos DAO
            const daoFields = await extractDaoFields(businessPath, selectedModelFolder);
            if (daoFields.length === 0) {
                vscode.window.showWarningMessage('No se encontraron campos DAO con anotación @Campo en la carpeta seleccionada.');
                return;
            }

            // 6. Create the webview for manual mapping (no automatic mapping)
            createEnhancedMappingWebview(context, context.extensionUri, dtoFields, daoFields);

        } catch (error) {
            vscode.window.showErrorMessage(`Error durante el procesamiento automático: ${error}`);
            console.error('❌ [DEBUG] Error en executeMapFromProject:', error);
        }
    }

    // Función para mostrar el menú principal
    async function showMainMenu() {
        const options = [
            {
                label: '📄 Mapear desde proyecto',
                description: 'Analizar estructura del proyecto y generar mapeos',
                action: 'project'
            },
            {
                label: '🌐 Mapear con Preview URL',
                description: 'Generar mapeos desde una URL de preview',
                action: 'preview'
            }
        ];

        const selection = await vscode.window.showQuickPick(options, {
            title: 'MapStruct Generator - Selecciona una opción',
            placeHolder: 'Elige el método de mapeo que deseas utilizar'
        });

        if (!selection) {
            vscode.window.showInformationMessage('Operación cancelada por el usuario.');
            return;
        }

        switch (selection.action) {
            case 'project':
                await executeMapFromProject();
                break;
            case 'preview':
                await executeMapFromPreview();
                break;
        }
    }

    // Función para ejecutar mapeo desde Preview URL usando webview modal
    async function executeMapFromPreview() {
        try {
            console.log('🎯 [DEBUG] Iniciando proceso de Preview URL con webview modal');

            // Crear webview modal para input de usuario
            createPreviewInputWebview(context);

        } catch (error) {
            console.error('❌ [DEBUG] Error en executeMapFromPreview:', error);
            vscode.window.showErrorMessage(`Error iniciando proceso de preview: ${error}`);
        }
    }

    // Función para crear webview modal de input
    function createPreviewInputWebview(context: vscode.ExtensionContext) {
        // Crear panel modal para input
        const panel = vscode.window.createWebviewPanel(
            'previewInput',
            'MapStruct - Configuración Preview URL',
            vscode.ViewColumn.Active,
            {
                enableScripts: true,
                retainContextWhenHidden: true // Importante: mantener contexto
            }
        );

        // Manejar mensajes desde el webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'submitConfig':
                        await processPreviewConfiguration(message.data, panel, context);
                        break;
                    case 'cancel':
                        panel.dispose();
                        vscode.window.showInformationMessage('Configuración de Preview URL cancelada');
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        // Establecer contenido HTML del webview modal
        panel.webview.html = getPreviewInputWebviewContent();
    }

    // Función para procesar la configuración del preview
    async function processPreviewConfiguration(data: any, inputPanel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
        try {
            console.log('🔄 [DEBUG] Procesando configuración de preview:', data);

            let authHeaders = {};

            // Procesar cookies si se proporcionaron
            if (data.needsAuth && data.cookies) {
                const extractedCookies = extractRequiredCookies(data.cookies);

                if (extractedCookies) {
                    authHeaders = { 'Cookie': extractedCookies };
                    console.log(`✅ [DEBUG] Cookies extraídas: ${extractedCookies.split(';').length} cookie(s) válida(s)`);
                } else {
                    console.warn('⚠️ [DEBUG] No se encontraron cookies válidas');
                    vscode.window.showWarningMessage('No se encontraron cookies válidas. Continuando sin autenticación...');
                }
            }

            // Mostrar progreso en el panel de input
            inputPanel.webview.postMessage({
                command: 'showProgress',
                message: '🌐 Obteniendo datos del preview...'
            });

            // Realizar petición HTTP
            const mappingData = await fetchMappingData(data.url, authHeaders);

            if (mappingData) {
                // Cerrar panel de input
                inputPanel.dispose();

                // Crear webview principal con los datos
                createPreviewMappingWebview(context, context.extensionUri, mappingData, data.url);
                vscode.window.showInformationMessage('✅ Mapeos cargados exitosamente desde Preview URL');
            } else {
                // Mostrar error en el panel
                inputPanel.webview.postMessage({
                    command: 'showError',
                    message: 'No se pudieron obtener datos válidos del preview'
                });
            }

        } catch (error) {
            console.error('❌ [DEBUG] Error procesando configuración:', error);

            // Mostrar error en el panel
            inputPanel.webview.postMessage({
                command: 'showError',
                message: `Error: ${error}`
            });
        }
    }

    // Registrar comandos en el contexto
    context.subscriptions.push(disposable, showMainMenuDisposable, mapFromProjectDisposable, mapFromPreviewDisposable, mapFromImagesDisposable);

    console.log('📋 [DEBUG] Extensión "mapstruct-generator" completamente activada');
}

/**
 * Función para extraer cookies específicas del texto pegado por el usuario
 */
function extractRequiredCookies(cookiesText: string): string | null {
    console.log('🍪 [DEBUG] Extrayendo cookies específicas...');
    console.log('📋 [DEBUG] Texto de cookies recibido:', cookiesText);

    // Cookies que necesitamos extraer
    const requiredCookies = ['__Host-GCP_IAP_AUTH_TOKEN_C2D51EA19EA3A213', 'GCP_IAP_UID'];
    const extractedCookies: string[] = [];

    try {
        // Limpiar el texto y dividir por punto y coma
        const cookiePairs = cookiesText
            .split(';')
            .map(pair => pair.trim())
            .filter(pair => pair.length > 0);

        console.log('📋 [DEBUG] Pares de cookies encontrados:', cookiePairs);

        // Buscar cada cookie requerida
        for (const requiredCookie of requiredCookies) {
            for (const cookiePair of cookiePairs) {
                // Verificar si esta cookie coincide con la que buscamos
                if (cookiePair.toLowerCase().startsWith(requiredCookie.toLowerCase() + '=')) {
                    // Extraer el valor completo (incluyendo el nombre)
                    const [name, ...valueParts] = cookiePair.split('=');
                    const value = valueParts.join('='); // En caso de que el valor contenga '='

                    if (value && value.trim().length > 0) {
                        extractedCookies.push(`${name.trim()}=${value.trim()}`);
                        console.log(`✅ [DEBUG] Cookie extraída: ${name.trim()}=${value.trim()}`);
                    }
                    break; // Solo tomar la primera coincidencia
                }
            }
        }

        if (extractedCookies.length === 0) {
            console.warn('⚠️ [DEBUG] No se encontraron cookies válidas');
            return null;
        }

        const result = extractedCookies.join('; ');
        console.log(`🎉 [DEBUG] Cookies finales extraídas: ${result}`);
        return result;

    } catch (error) {
        console.error('❌ [DEBUG] Error extrayendo cookies:', error);
        return null;
    }
}

/**
 * Función para obtener datos de mapeo desde una URL
 */
async function fetchMappingData(url: string, authHeaders: any): Promise<any> {
    try {
        console.log(`🌐 [DEBUG] Realizando petición GET a: ${url}`);

        // Usar fetch nativo de Node.js (disponible desde Node 18+)
        const headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'MapStruct-Generator-VSCode/1.0.0',
            ...authHeaders
        };

        // Crear AbortController para timeout manual
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

        const response = await fetch(url, {
            method: 'GET',
            headers: headers,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json() as any;
        console.log('✅ [DEBUG] Datos obtenidos exitosamente');
        console.log('📋 [DEBUG] Estructura de datos:', JSON.stringify(data, null, 2));

        // Validate the basic structure of the response
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid response: data is not an object');
        }

        // Check if this is the expected structure for transformation
        if (!data.data.id || !data.data.details || !Array.isArray(data.data.details)) {
            console.log('⚠️ [DEBUG] Response does not match expected structure for transformation, returning raw data');
            return data;
        }

        // Part 1: Identify Backend Information
        const id = data.data.id;

        const backendAccessObj = data.data.details.find((detail: any) => detail.key === "backendAccess");
        if (!backendAccessObj) {
            throw new Error('Backend access information not found in response');
        }

        if (!backendAccessObj.value || !backendAccessObj.value.type || !backendAccessObj.value.backendIdentifier) {
            throw new Error('Invalid backend access object: missing required fields');
        }

        const backend_type = backendAccessObj.value.type;
        const trx_name = backendAccessObj.value.backendIdentifier;

        // Part 2: Map Service Fields
        // Find all serviceMapping entries (they are individual objects, not an array)
        const serviceMappingObjs = data.data.details.filter((detail: any) => detail.key === "serviceMapping");
        if (serviceMappingObjs.length === 0) {
            throw new Error('No service mapping information found in response');
        }

        console.log(`🔍 [DEBUG] Found ${serviceMappingObjs.length} service mapping entries`);

        // Filter mappings that match our backend ID
        const matchingMappings = serviceMappingObjs.filter((mappingObj: any) =>
            mappingObj.value &&
            mappingObj.value.backend &&
            mappingObj.value.backend.id === trx_name
        );

        if (matchingMappings.length === 0) {
            throw new Error(`No matching service mappings found for backend ID: ${trx_name}`);
        }

        console.log(`🎯 [DEBUG] Found ${matchingMappings.length} matching mappings for backend: ${trx_name}`);

        const input_fields: any[] = [];
        const output_fields: any[] = [];

        // Process each matching service mapping entry
        matchingMappings.forEach((mappingObj: any) => {
            const item = mappingObj.value;

            // Validate item structure
            if (!item || typeof item !== 'object') {
                console.warn('⚠️ [DEBUG] Skipping invalid service mapping item:', item);
                return;
            }

            if (!item.inputOutput || !item.external || !item.internal) {
                console.warn('⚠️ [DEBUG] Skipping service mapping item with missing required fields:', item);
                return;
            }

            console.log(`🔄 [DEBUG] Processing ${item.inputOutput} field: ${item.external} -> ${item.internal}`);

            if (item.inputOutput === "input") {
                // Input field processing
                let field_type: string;
                if (item.external.startsWith('{')) {
                    // Note: User input might be required to distinguish between "uri-param" and "header"
                    field_type = "uri-param"; // Default assumption
                } else {
                    field_type = "body";
                }

                const source = item.external;

                // Process target and format from item.internal
                let format = "";
                let target = "";
                if (/\w+-\w+/.test(item.internal)) {
                    const parts = item.internal.split('-');
                    format = parts[0];
                    target = parts[1].toLowerCase();
                } else {
                    format = "";
                    target = item.internal.toLowerCase();
                }

                input_fields.push({
                    format,
                    field_type,
                    source,
                    target
                });
            } else {
                // Output field processing (assuming item.inputOutput === "output")
                let field_type: string;
                if (item.external.startsWith('{')) {
                    // Note: User input might be required to distinguish between "uri-param" and "header"
                    field_type = "header"; // Default assumption for output
                } else {
                    field_type = "body";
                }

                const target = item.external;

                // Process source and format from item.internal
                let format = "";
                let source = "";
                if (/\w+-\w+/.test(item.internal)) {
                    const parts = item.internal.split('-');
                    format = parts[0];
                    source = parts[1].toLowerCase();
                } else {
                    format = "";
                    source = item.internal.toLowerCase();
                }

                output_fields.push({
                    format,
                    field_type,
                    source,
                    target
                });
            }
        });

        // Construct and return the transformed JSON object
        const transformedData = {
            id,
            mappings: [
                {
                    backend_type,
                    trx_name,
                    fields: {
                        input_fields,
                        output_fields
                    }
                }
            ]
        };

        console.log('🔄 [DEBUG] Data transformed successfully');
        console.log('📋 [DEBUG] Transformed structure:', JSON.stringify(transformedData, null, 2));

        // Print detailed mapping information
        console.log('🎯 [DEBUG] MAPEO GENERADO:');
        console.log('📍 [DEBUG] ID:', id);
        console.log('🏗️ [DEBUG] Backend Type:', backend_type);
        console.log('🔗 [DEBUG] Transaction Name:', trx_name);
        console.log('📥 [DEBUG] Input Fields:', input_fields.length);
        input_fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.source} -> ${field.target} (${field.field_type}) [${field.format}]`);
        });
        console.log('📤 [DEBUG] Output Fields:', output_fields.length);
        output_fields.forEach((field, index) => {
            console.log(`  ${index + 1}. ${field.source} -> ${field.target} (${field.field_type}) [${field.format}]`);
        });
        console.log('✅ [DEBUG] MAPEO COMPLETO GENERADO');

        return transformedData;

    } catch (error) {
        console.error('❌ [DEBUG] Error en fetchMappingData:', error);

        if (error instanceof TypeError && error.message.includes('fetch')) {
            throw new Error('Error de conexión. Verifica la URL y tu conexión a internet.');
        } else if (error instanceof SyntaxError) {
            throw new Error('La respuesta no es un JSON válido.');
        } else {
            throw error;
        }
    }
}

/**
 * Función para normalizar y formatear datos de mapeo desde diferentes formatos
 */
function formatMappingData(rawData: any): { dtoFields: GroupedFields; daoFields: JavaField[] } {
    console.log('🔄 [DEBUG] Formateando datos de mapeo...');

    // Estructura esperada genérica
    let dtoFields: GroupedFields = {};
    let daoFields: JavaField[] = [];

    try {
        // Intento 1: Estructura directa con dtoFields y daoFields
        if (rawData.dtoFields && rawData.daoFields) {
            dtoFields = rawData.dtoFields;
            daoFields = rawData.daoFields;
        }
        // Intento 2: Estructura con mappings que contiene source y target
        else if (rawData.mappings) {
            const mappings = rawData.mappings;

            // Extraer campos DTO (source)
            if (mappings.source) {
                dtoFields = mappings.source;
            }

            // Extraer campos DAO (target)
            if (mappings.target && Array.isArray(mappings.target)) {
                daoFields = mappings.target;
            }
        }
        // Intento 3: Estructura plana con arrays
        else if (rawData.dto && rawData.dao) {
            // Convertir arrays planos a formato agrupado
            if (Array.isArray(rawData.dto)) {
                rawData.dto.forEach((field: any) => {
                    const className = field.className || 'DefaultDTO';
                    if (!dtoFields[className]) {
                        dtoFields[className] = [];
                    }
                    dtoFields[className].push({
                        name: field.name || field.fieldName,
                        type: field.type || field.fieldType || 'String',
                        className: className
                    });
                });
            }

            if (Array.isArray(rawData.dao)) {
                daoFields = rawData.dao.map((field: any) => ({
                    name: field.name || field.fieldName,
                    type: field.type || field.fieldType || 'String',
                    className: field.className || 'DefaultDAO'
                }));
            }
        }
        // Intento 4: Datos de ejemplo si no se puede parsear
        else {
            console.warn('⚠️ [DEBUG] Formato no reconocido, usando datos de ejemplo');

            dtoFields = {
                'UserDTO': [
                    { name: 'id', type: 'Long', className: 'UserDTO' },
                    { name: 'username', type: 'String', className: 'UserDTO' },
                    { name: 'email', type: 'String', className: 'UserDTO' }
                ],
                'ProfileDTO': [
                    { name: 'firstName', type: 'String', className: 'ProfileDTO' },
                    { name: 'lastName', type: 'String', className: 'ProfileDTO' }
                ]
            };

            daoFields = [
                { name: 'userId', type: 'Long', className: 'User' },
                { name: 'userName', type: 'String', className: 'User' },
                { name: 'userEmail', type: 'String', className: 'User' },
                { name: 'firstName', type: 'String', className: 'Profile' },
                { name: 'lastName', type: 'String', className: 'Profile' }
            ];
        }

        console.log('✅ [DEBUG] Datos formateados exitosamente');
        console.log(`📊 [DEBUG] DTO Fields: ${Object.keys(dtoFields).length} clases`);
        console.log(`📊 [DEBUG] DAO Fields: ${daoFields.length} campos`);

        return { dtoFields, daoFields };

    } catch (error) {
        console.error('❌ [DEBUG] Error formateando datos:', error);

        // Retornar estructura vacía en caso de error
        return {
            dtoFields: {},
            daoFields: []
        };
    }
}

/**
 * Crea el webview para mostrar mapeos obtenidos desde Preview URL
 */
function createPreviewMappingWebview(
    context: vscode.ExtensionContext,
    extensionUri: vscode.Uri,
    rawData: any,
    sourceUrl: string
) {
    console.log('🖥️ [DEBUG] Creando webview para preview mappings...');

    // Formatear los datos recibidos
    const { dtoFields, daoFields } = formatMappingData(rawData);

    // Validar que tenemos datos para mostrar
    if (Object.keys(dtoFields).length === 0 && daoFields.length === 0) {
        vscode.window.showWarningMessage('No se encontraron datos de mapeo válidos en la URL proporcionada.');
        return;
    }

    // Crear el panel del webview
    const panel = vscode.window.createWebviewPanel(
        'previewMapping',
        'MapStruct - Preview Mappings',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        }
    );

    // Manejar mensajes desde el webview
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'generateMapstruct':
                    generateMapstructFromPreview(message.mappings, sourceUrl, rawData);
                    break;
                case 'refreshData':
                    vscode.window.showInformationMessage('Datos actualizados desde Preview URL');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // Contar totales para estadísticas
    const totalDtoFields = Object.values(dtoFields).reduce((total, fields) => total + fields.length, 0);
    const totalDaoFields = daoFields.length;

    // Establecer el contenido HTML del webview
    panel.webview.html = getPreviewWebviewContent(dtoFields, daoFields, totalDtoFields, totalDaoFields, sourceUrl);
}

/**
 * Crea el webview mejorado para el mapeo interactivo de campos.
 */
function createEnhancedMappingWebview(
    context: vscode.ExtensionContext,
    extensionUri: vscode.Uri,
    dtoFields: GroupedFields,
    daoFields: JavaField[]
) {
    // Crear el panel del webview
    const panel = vscode.window.createWebviewPanel(
        'mapstructMapping',
        'MapStruct - Mapeo de Campos',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
        }
    );

    // Manejar mensajes desde el webview
    panel.webview.onDidReceiveMessage(
        async message => {
            switch (message.command) {
                case 'clearMappings':
                    vscode.window.showInformationMessage('Mapeos limpiados');
                    break;
                case 'undoMapping':
                    vscode.window.showInformationMessage('Último mapeo deshecho');
                    break;
                case 'generateMapstruct':
                    await generateMapstructConfig(message.mappings);
                    break;
                case 'autoMapping':
                    vscode.window.showInformationMessage('Auto-mapeo ejecutado');
                    break;
            }
        },
        undefined,
        context.subscriptions
    );

    // Contar totales para estadísticas
    const totalDtoFields = Object.values(dtoFields).reduce((total, fields) => total + fields.length, 0);
    const totalDaoFields = daoFields.length;

    // Establecer el contenido HTML del webview
    panel.webview.html = getWebviewContent(dtoFields, daoFields, totalDtoFields, totalDaoFields);
}

/**
 * Genera la configuración de MapStruct desde los mapeos creados.
 */
async function generateMapstructConfig(mappings: any[]) {
    console.log('🔧 [DEBUG] Generando configuración MapStruct...');
    console.log('📋 [DEBUG] Mapeos recibidos:', JSON.stringify(mappings, null, 2));

    // Ask user for backend type
    const backendOptions = [
        { label: 'HOST', detail: 'Sistema Host mainframe' },
        { label: 'APX', detail: 'Sistema APX' }
    ];

    const backendSelection = await vscode.window.showQuickPick(backendOptions, {
        title: 'Selecciona el tipo de backend',
        placeHolder: '¿Es un sistema HOST o APX?'
    });

    if (!backendSelection) {
        vscode.window.showInformationMessage('Generación de MapStruct cancelada.');
        return;
    }

    const backend_type = backendSelection.label;

    // Get the selected model folder name from global variable
    const trx_name = getSelectedModelFolderName();

    // Transform webview mappings to the correct format
    const input_fields: any[] = [];
    const output_fields: any[] = [];

    mappings.forEach((mapping: any) => {
        mapping.dtoFields.forEach((dtoField: any) => {
            mapping.daoFields.forEach((daoField: any) => {
                // Apply Rule 1: Determine source/target based on DTO prefix
                // NO LIMPIAR NOMBRES - usar exactamente como vienen
                if (dtoField.name.startsWith('BDtoIn')) {
                    // DTO is source, DAO is target, add to input_fields
                    input_fields.push({
                        format: daoField.className, // Rule 2: Format is DAO class name
                        field_type: "body", // Default field type
                        source: dtoField.name, // Mantener nombre exacto del DTO
                        target: daoField.name   // Mantener nombre exacto del DAO
                    });
                } else if (dtoField.name.startsWith('BDtoOut')) {
                    // DTO is target, DAO is source, add to output_fields
                    output_fields.push({
                        format: daoField.className, // Rule 2: Format is DAO class name
                        field_type: "body", // Default field type
                        source: daoField.name,   // Mantener nombre exacto del DAO
                        target: dtoField.name    // Mantener nombre exacto del DTO
                    });
                } else {
                    // Fields without BDtoIn/BDtoOut prefix - treat as input by default
                    input_fields.push({
                        format: daoField.className,
                        field_type: "body",
                        source: dtoField.name, // Mantener nombre exacto del DTO
                        target: daoField.name  // Mantener nombre exacto del DAO
                    });
                }
            });
        });
    });

    // Generate the target JSON structure (same as executeMapFromPreview)
    const transformedData = {
        id: `project-${Date.now()}`, // Generate unique ID for project-based mapping
        mappings: [
            {
                backend_type: backend_type, // Usuario seleccionó HOST o APX
                trx_name: trx_name, // Nombre de la carpeta seleccionada en dao/model/
                fields: {
                    input_fields: input_fields,
                    output_fields: output_fields
                }
            }
        ]
    };

    // Print detailed mapping information (matching executeMapFromPreview format)
    console.log('🔄 [DEBUG] Data transformed successfully');
    console.log('📋 [DEBUG] Transformed structure:', JSON.stringify(transformedData, null, 2));

    // Print detailed mapping information
    console.log('🎯 [DEBUG] MAPEO GENERADO:');
    console.log('📍 [DEBUG] ID:', transformedData.id);
    console.log('🏗️ [DEBUG] Backend Type:', transformedData.mappings[0].backend_type);
    console.log('🔗 [DEBUG] Transaction Name:', transformedData.mappings[0].trx_name);
    console.log('📥 [DEBUG] Input Fields:', input_fields.length);
    input_fields.forEach((field: any, index: number) => {
        console.log(`  ${index + 1}. ${field.source} -> ${field.target} (${field.field_type}) [${field.format}]`);
    });
    console.log('📤 [DEBUG] Output Fields:', output_fields.length);
    output_fields.forEach((field: any, index: number) => {
        console.log(`  ${index + 1}. ${field.source} -> ${field.target} (${field.field_type}) [${field.format}]`);
    });
    console.log('✅ [DEBUG] MAPEO COMPLETO GENERADO');

    vscode.window.showInformationMessage(`MapStruct generado con ${mappings.length} mapeos manuales. Ver consola para detalles.`);
}

/**
 * Genera la configuración de MapStruct desde preview URL
 */
function generateMapstructFromPreview(mappings: any[], sourceUrl: string, originalData: any) {
    console.log('🔧 [DEBUG] Generando configuración MapStruct desde Preview URL...');
    console.log('📋 [DEBUG] Mapeos recibidos:', JSON.stringify(mappings, null, 2));

    // TODO: Integrar con API para generar código MapStruct real
    const jsonOutput = {
        timestamp: new Date().toISOString(),
        totalMappings: mappings.length,
        mappings: mappings,
        source: 'preview-url',
        sourceUrl: sourceUrl,
        originalData: originalData
    };

    console.log('📄 [DEBUG] JSON generado desde Preview:', JSON.stringify(jsonOutput, null, 2));
    vscode.window.showInformationMessage(`MapStruct generado con ${mappings.length} mapeos desde Preview URL. Ver consola para detalles.`);
}

/**
 * Genera el contenido HTML para el webview de mapeo.
 */
function getWebviewContent(
    dtoFields: GroupedFields,
    daoFields: JavaField[],
    totalDtoFields: number,
    totalDaoFields: number
): string {
    const dtoFieldsJson = JSON.stringify(dtoFields);
    const daoFieldsJson = JSON.stringify(daoFields);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MapStruct - Mapeo de Campos</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow-x: hidden;
        }

        .header {
            background: var(--vscode-panel-background);
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            font-size: 18px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .stats {
            display: flex;
            gap: 20px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .controls {
            background: var(--vscode-panel-background);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
        }

        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .search-container {
            background: var(--vscode-panel-background);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 12px;
        }

        .search-box {
            flex: 1;
            position: relative;
        }

        .search-input {
            width: 100%;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            color: var(--vscode-input-foreground);
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 13px;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
        }

        .main-container {
            display: flex;
            height: calc(100vh - 140px);
        }

        .panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .panel:last-child {
            border-right: none;
        }

        .panel-header {
            background: var(--vscode-panel-background);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            font-size: 14px;
        }

        .fields-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .field-group {
            margin-bottom: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .group-header {
            background: var(--vscode-panel-background);
            padding: 12px 16px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 500;
        }

        .group-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .group-toggle {
            transition: transform 0.2s;
        }

        .group-toggle.collapsed {
            transform: rotate(-90deg);
        }

        .fields-list {
            background: var(--vscode-editor-background);
        }

        .fields-list.collapsed {
            display: none;
        }

        .field-item {
            padding: 10px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background-color 0.2s;
            position: relative;
        }

        .field-item:last-child {
            border-bottom: none;
        }

        .field-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .field-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .field-item.mapped {
            border-left: 4px solid transparent;
            position: relative;
        }

        .field-name {
            font-weight: 500;
            margin-bottom: 2px;
        }

        .field-type {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .dao-field-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .dao-field-item:last-child {
            border-bottom: none;
        }

        .dao-field-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .dao-field-item.selected {
            background: var(--vscode-list-activeSelectionBackground);
            color: var(--vscode-list-activeSelectionForeground);
        }

        .dao-field-item.mapped {
            border-left: 4px solid transparent;
            position: relative;
        }

        .mapping-indicator {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 12px;
            height: 12px;
            border-radius: 50%;
            display: none;
            border: 2px solid var(--vscode-editor-background);
        }

        .field-item.mapped .mapping-indicator,
        .dao-field-item.mapped .mapping-indicator {
            display: block;
        }

        /* Colores para múltiples mapeos */
        .multi-color-indicator {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            width: 56px;
            height: 12px;
            display: none;
            border-radius: 6px;
            overflow: hidden;
        }

        .field-item.mapped.multi-mapped .multi-color-indicator,
        .dao-field-item.mapped.multi-mapped .multi-color-indicator {
            display: block;
        }

        .field-item.mapped.multi-mapped .mapping-indicator,
        .dao-field-item.mapped.multi-mapped .mapping-indicator {
            display: none;
        }

        .color-stripe {
            height: 100%;
            float: left;
        }

        /* Los colores ahora se aplican dinámicamente via JavaScript */

        /* Estilos para mapeos con warnings direccionales */
        .field-item.mapped.warning,
        .dao-field-item.mapped.warning {
            border-left-color: #ff6b35 !important;
            border-left-style: dashed !important;
            border-left-width: 4px !important;
            background: linear-gradient(90deg, rgba(255, 107, 53, 0.1) 0%, transparent 10%);
        }

        .field-item.mapped.warning::before,
        .dao-field-item.mapped.warning::before {
            content: "⚠️";
            position: absolute;
            left: -2px;
            top: 2px;
            font-size: 10px;
            z-index: 10;
            background: var(--vscode-editor-background);
            border-radius: 2px;
            padding: 1px;
        }

        /* Tooltip para mostrar información del mapeo */
        .mapping-tooltip {
            position: absolute;
            background: var(--vscode-editor-hoverHighlightBackground);
            border: 1px solid var(--vscode-contrastBorder);
            border-radius: 4px;
            padding: 8px;
            font-size: 11px;
            z-index: 1000;
            display: none;
            max-width: 200px;
            color: var(--vscode-editor-foreground);
        }

        .mapping-count {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 2px 6px;
            border-radius: 10px;
            font-size: 11px;
            margin-left: 8px;
        }

        .no-results {
            padding: 20px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .status-bar {
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            padding: 8px 20px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            display: flex;
            justify-content: space-between;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MapStruct - Mapeo de Campos</h1>
        <div class="stats">
            <span>DTO: ${totalDtoFields} campos</span>
            <span>DAO: ${totalDaoFields} campos</span>
            <span id="mappedCount">Mapeados: 0</span>
        </div>
    </div>

    <div class="controls">
        <button class="btn" onclick="autoMapping()">🎯 Auto-mapeo</button>
        <button class="btn secondary" onclick="clearMappings()">🗑️ Limpiar</button>
        <button class="btn secondary" onclick="undoMapping()">↶ Deshacer</button>
        <button class="btn" onclick="generateMapstruct()">⚡ Generar MapStruct</button>
    </div>

    <div class="search-container">
        <div class="search-box">
            <input type="text" class="search-input" id="dtoSearch" placeholder="Buscar campos DTO..." oninput="filterFields('dto')">
        </div>
        <div class="search-box">
            <input type="text" class="search-input" id="daoSearch" placeholder="Buscar campos DAO..." oninput="filterFields('dao')">
        </div>
    </div>

    <div class="main-container">
        <div class="panel">
            <div class="panel-header">📄 Campos DTO</div>
            <div class="fields-container" id="dtoContainer"></div>
        </div>
        <div class="panel">
            <div class="panel-header">🏗️ Campos DAO</div>
            <div class="fields-container" id="daoContainer"></div>
        </div>
    </div>

    <div class="status-bar">
        <span id="statusText">Selecciona campos para crear mapeos</span>
        <span id="progressText">0% completado</span>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Estado global
        let dtoFields = ${dtoFieldsJson};
        let daoFields = ${daoFieldsJson};
        let selectedDtoFields = [];
        let selectedDaoFields = [];
        let mappings = [];
        let mappingHistory = [];
        let usedColors = new Set(); // Para rastrear colores utilizados
        let colorIndex = 0; // Índice del próximo color disponible
        let colorPalette = []; // Paleta de colores generada dinámicamente

        // Inicializar interfaz
        document.addEventListener('DOMContentLoaded', function() {
            generateColorPalette();
            renderDtoFields();
            renderDaoFields();
            updateStats();
        });

        // Función para generar una paleta de 120 colores únicos y diversos
        function generateColorPalette() {
            colorPalette = [];
            const totalColors = 120;

            // Crear generador de números aleatorios con semilla para reproducibilidad
            let seed = 12345;
            function seededRandom() {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            }

            // Estrategia 1: Colores base predefinidos de alta calidad (40 colores)
            const baseColors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#F39C12', '#9B59B6',
                '#E74C3C', '#2ECC71', '#3498DB', '#F1C40F', '#8E44AD',
                '#E67E22', '#1ABC9C', '#34495E', '#95A5A6', '#D35400',
                '#27AE60', '#2980B9', '#8E44AD', '#F39C12', '#C0392B',
                '#16A085', '#2C3E50', '#7F8C8D', '#D68910', '#A569BD',
                '#DC7633', '#48C9B0', '#5DADE2', '#F7DC6F', '#BB8FCE',
                '#85C1E9', '#82E0AA', '#F8C471', '#D7BDE2', '#AED6F1',
                '#A3E4D7', '#FCF3CF', '#FADBD8', '#EBF5FB', '#E8F8F5'
            ];

            // Agregar colores base
            baseColors.forEach(color => colorPalette.push(color));

            // Estrategia 2: Colores aleatorios con alta saturación (40 colores)
            for (let i = 0; i < 40; i++) {
                const hue = Math.floor(seededRandom() * 360);
                const saturation = 70 + Math.floor(seededRandom() * 30); // 70-100%
                const lightness = 45 + Math.floor(seededRandom() * 25);  // 45-70%

                const color = \`hsl(\${hue}, \${saturation}%, \${lightness}%)\`;
                colorPalette.push(color);
            }

            // Estrategia 3: Colores complementarios y triádicos (40 colores)
            for (let i = 0; i < 40; i++) {
                const baseHue = Math.floor(seededRandom() * 360);
                let hue;

                if (i % 3 === 0) {
                    // Color complementario (180° opuesto)
                    hue = (baseHue + 180) % 360;
                } else if (i % 3 === 1) {
                    // Color triádico (120° separación)
                    hue = (baseHue + 120) % 360;
                } else {
                    // Color triádico inverso (240° separación)
                    hue = (baseHue + 240) % 360;
                }

                const saturation = 60 + Math.floor(seededRandom() * 40); // 60-100%
                const lightness = 40 + Math.floor(seededRandom() * 30);  // 40-70%

                const color = \`hsl(\${hue}, \${saturation}%, \${lightness}%)\`;
                colorPalette.push(color);
            }

            // Mezclar la paleta para distribuir mejor los colores
            shuffleArray(colorPalette);

            console.log(\`🎨 Paleta de \${colorPalette.length} colores diversos generada\`);
            console.log('🔍 Primeros 10 colores:', colorPalette.slice(0, 10));
        }

        // Función para mezclar un array (Fisher-Yates shuffle)
        function shuffleArray(array) {
            let seed = 54321;
            function seededRandom() {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            }

            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(seededRandom() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        // Función para obtener el siguiente color único
        function getNextUniqueColor() {
            // Buscar el primer color no utilizado
            for (let i = 0; i < colorPalette.length; i++) {
                if (!usedColors.has(i)) {
                    usedColors.add(i);
                    return i;
                }
            }

            // Si todos los colores están en uso (muy improbable con 120 colores)
            console.warn('⚠️ Todos los colores están en uso, reutilizando...');
            const fallbackIndex = usedColors.size % colorPalette.length;
            return fallbackIndex;
        }

        // Función para liberar un color cuando se elimina un mapeo
        function releaseColor(colorIndex) {
            // Verificar si el color ya no está siendo usado por ningún mapeo
            const isStillUsed = mappings.some(mapping => mapping.color === colorIndex);
            if (!isStillUsed) {
                usedColors.delete(colorIndex);
            }
        }

        // Función para obtener el color CSS de un índice
        function getColorByIndex(index) {
            return colorPalette[index] || '#007ACC'; // Fallback al azul VS Code
        }

        function renderDtoFields() {
            const container = document.getElementById('dtoContainer');
            container.innerHTML = '';

            for (const [className, fields] of Object.entries(dtoFields)) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'field-group';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'group-header';
                headerDiv.onclick = () => toggleGroup(headerDiv);
                headerDiv.innerHTML = \`
                    <span>\${className} (\${fields.length})</span>
                    <span class="group-toggle">▼</span>
                \`;

                const fieldsDiv = document.createElement('div');
                fieldsDiv.className = 'fields-list';

                fields.forEach(field => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'field-item';
                    fieldDiv.dataset.fieldId = \`\${field.className}.\${field.name}\`;
                    fieldDiv.onclick = () => selectDtoField(fieldDiv, field);
                    fieldDiv.innerHTML = \`
                        <div class="field-name">\${field.name}</div>
                        <div class="field-type">\${field.type}</div>
                        <div class="mapping-indicator"></div>
                        <div class="multi-color-indicator"></div>
                        <div class="mapping-tooltip"></div>
                    \`;
                    fieldsDiv.appendChild(fieldDiv);
                });

                groupDiv.appendChild(headerDiv);
                groupDiv.appendChild(fieldsDiv);
                container.appendChild(groupDiv);
            }
        }

        function renderDaoFields() {
            const container = document.getElementById('daoContainer');
            container.innerHTML = '';

            daoFields.forEach(field => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'dao-field-item';
                fieldDiv.dataset.fieldId = \`\${field.className}.\${field.name}\`;
                fieldDiv.onclick = () => selectDaoField(fieldDiv, field);
                fieldDiv.innerHTML = \`
                    <div class="field-name">\${field.name}</div>
                    <div class="field-type">\${field.type} <span style="font-size: 11px;">(\${field.className})</span></div>
                    <div class="mapping-indicator"></div>
                    <div class="multi-color-indicator"></div>
                    <div class="mapping-tooltip"></div>
                \`;
                container.appendChild(fieldDiv);
            });
        }

        function toggleGroup(header) {
            const toggle = header.querySelector('.group-toggle');
            const fieldsList = header.nextElementSibling;

            fieldsList.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
        }

        function selectDtoField(element, field) {
            if (element.classList.contains('selected')) {
                element.classList.remove('selected');
                selectedDtoFields = selectedDtoFields.filter(f => f.name !== field.name);
            } else {
                element.classList.add('selected');
                selectedDtoFields.push(field);
            }
            updateStatus();
            // Intentar crear mapeo si ya hay campos DAO seleccionados
            if (selectedDaoFields.length > 0) {
                createMapping();
            }
        }

        function selectDaoField(element, field) {
            if (element.classList.contains('selected')) {
                element.classList.remove('selected');
                selectedDaoFields = selectedDaoFields.filter(f => f.name !== field.name);
            } else {
                element.classList.add('selected');
                selectedDaoFields.push(field);
            }
            updateStatus();
            // Intentar crear mapeo si ya hay campos DTO seleccionados
            if (selectedDtoFields.length > 0) {
                createMapping();
            }
        }

        // Function to validate DAO directionality (same as server-side validation)
        function validateDaoDirectionality(dtoFieldName, daoClassName) {
            // DAO Name Pattern: [4 letters][2 direction letters][2 numbers]
            const daoPattern = /^[A-Z]{4}([A-Z]{2})\\d{2}$/;
            const match = daoClassName.match(daoPattern);

            if (!match) {
                // DAO doesn't follow the expected pattern, skip validation
                return null;
            }

            const daoDirection = match[1]; // Extract direction letters (CE, FE, EE, CS, FS, SS)
            const inputDirections = ['CE', 'FE', 'EE'];
            const outputDirections = ['CS', 'FS', 'SS'];

            if (dtoFieldName.startsWith('BDtoIn')) {
                if (outputDirections.includes(daoDirection)) {
                    return \`⚠️ Incompatibilidad direccional: Campo DTO de entrada "\${dtoFieldName}" mapeado con DAO de salida "\${daoClassName}" (dirección \${daoDirection})\`;
                }
            } else if (dtoFieldName.startsWith('BDtoOut')) {
                if (inputDirections.includes(daoDirection)) {
                    return \`⚠️ Incompatibilidad direccional: Campo DTO de salida "\${dtoFieldName}" mapeado con DAO de entrada "\${daoClassName}" (dirección \${daoDirection})\`;
                }
            }

            return null; // No mismatch
        }

        function createMapping() {
            if (selectedDtoFields.length > 0 && selectedDaoFields.length > 0) {
                // Validate directionality for all selected fields
                const warnings = [];
                selectedDtoFields.forEach(dtoField => {
                    selectedDaoFields.forEach(daoField => {
                        const warning = validateDaoDirectionality(dtoField.name, daoField.className);
                        if (warning) {
                            warnings.push(warning);
                        }
                    });
                });

                // Show warnings if any incompatibilities are found
                if (warnings.length > 0) {
                    const warningMessage = warnings.join('\\n\\n');
                    const statusElement = document.getElementById('statusText');
                    if (statusElement) {
                        statusElement.style.color = '#ff6b35';
                        statusElement.textContent = \`⚠️ ADVERTENCIA: \${warnings.length} incompatibilidad(es) direccional(es) detectada(s)\`;
                    }
                    console.warn('🚨 [WARNING] Incompatibilidades direccionales detectadas:');
                    warnings.forEach(warning => console.warn(warning));

                    // Show popup warning but allow mapping to continue
                    alert(\`🚨 ADVERTENCIAS DIRECCIONALES:\\n\\n\${warningMessage}\\n\\nEl mapeo se creará pero revisa las incompatibilidades.\`);
                }

                // Guardar en historial para deshacer
                mappingHistory.push([...mappings]);

                // Crear nuevo mapeo con color único
                const uniqueColor = getNextUniqueColor();
                const newMapping = {
                    id: Date.now(),
                    dtoFields: [...selectedDtoFields],
                    daoFields: [...selectedDaoFields],
                    type: selectedDtoFields.length === 1 && selectedDaoFields.length === 1 ? '1:1' :
                          selectedDtoFields.length === 1 ? '1:N' : 'N:1',
                    color: uniqueColor,
                    warnings: warnings.length > 0 ? warnings : undefined // Store warnings in mapping
                };

                mappings.push(newMapping);

                // Marcar campos como mapeados con colores
                selectedDtoFields.forEach(field => {
                    const element = document.querySelector(\`[data-field-id="\${field.className}.\${field.name}"]\`);
                    if (element) {
                        applyMappingStyle(element, field, 'dto');
                        element.classList.remove('selected');
                    }
                });

                selectedDaoFields.forEach(field => {
                    const element = document.querySelector(\`[data-field-id="\${field.className}.\${field.name}"]\`);
                    if (element) {
                        applyMappingStyle(element, field, 'dao');
                        element.classList.remove('selected');
                    }
                });

                // Limpiar selecciones
                selectedDtoFields = [];
                selectedDaoFields = [];

                updateStats();
                updateStatus();
            }
        }

        function autoMapping() {
            const totalDto = Object.values(dtoFields).reduce((total, fields) => total + fields.length, 0);
            let matched = 0;

            // Auto-mapear campos con nombres idénticos
            for (const [className, fields] of Object.entries(dtoFields)) {
                fields.forEach(dtoField => {
                    const matchingDao = daoFields.find(daoField =>
                        daoField.name.toLowerCase() === dtoField.name.toLowerCase() &&
                        !mappings.some(m => m.daoFields.some(df => df.name === daoField.name))
                    );

                    if (matchingDao && !mappings.some(m => m.dtoFields.some(df => df.name === dtoField.name))) {
                        const uniqueColor = getNextUniqueColor();
                        mappings.push({
                            id: Date.now() + matched,
                            dtoFields: [dtoField],
                            daoFields: [matchingDao],
                            type: '1:1',
                            color: uniqueColor
                        });
                        matched++;
                    }
                });
            }

            renderDtoFields();
            renderDaoFields();
            markMappedFields();
            updateStats();

            vscode.postMessage({
                command: 'autoMapping'
            });
        }

        function markMappedFields() {
            // Limpiar estilos previos
            document.querySelectorAll('.mapped').forEach(el => {
                el.classList.remove('mapped', 'multi-mapped');
                // Limpiar estilos de color dinámicos
                el.style.borderLeftColor = '';
                const indicator = el.querySelector('.mapping-indicator');
                if (indicator) {
                    indicator.style.backgroundColor = '';
                }
            });

            // Aplicar nuevos estilos
            mappings.forEach(mapping => {
                mapping.dtoFields.forEach(field => {
                    const element = document.querySelector(\`[data-field-id="\${field.className}.\${field.name}"]\`);
                    if (element) {
                        applyMappingStyle(element, field, 'dto');
                    }
                });

                mapping.daoFields.forEach(field => {
                    const element = document.querySelector(\`[data-field-id="\${field.className}.\${field.name}"]\`);
                    if (element) {
                        applyMappingStyle(element, field, 'dao');
                    }
                });
            });
        }

        function applyMappingStyle(element, field, fieldType) {
            // Encontrar todos los mapeos que incluyen este campo
            const fieldMappings = mappings.filter(mapping => {
                if (fieldType === 'dto') {
                    return mapping.dtoFields.some(f => f.name === field.name && f.className === field.className);
                } else {
                    return mapping.daoFields.some(f => f.name === field.name && f.className === field.className);
                }
            });

            if (fieldMappings.length === 0) return;

            element.classList.add('mapped');

            if (fieldMappings.length === 1) {
                // Mapeo simple - usar color único
                const mapping = fieldMappings[0];
                const color = getColorByIndex(mapping.color);

                // Check if mapping has warnings and apply warning style
                if (mapping.warnings && mapping.warnings.length > 0) {
                    element.classList.add('warning');
                    element.title = \`⚠️ Advertencia direccional: \${mapping.warnings.join('; ')}\`;
                } else {
                    element.classList.remove('warning');
                    // Aplicar color dinámicamente
                    element.style.borderLeftColor = color;
                    element.style.borderLeftStyle = 'solid';
                }

                const indicator = element.querySelector('.mapping-indicator');
                if (indicator) {
                    indicator.style.backgroundColor = color;
                }

                // Agregar tooltip
                setupTooltip(element, fieldMappings, fieldType);
            } else {
                // Mapeos múltiples - usar indicador multicolor
                element.classList.add('multi-mapped');

                // Check if any of the multiple mappings have warnings
                const hasWarnings = fieldMappings.some(mapping => mapping.warnings && mapping.warnings.length > 0);
                if (hasWarnings) {
                    element.classList.add('warning');
                    const allWarnings = fieldMappings
                        .filter(mapping => mapping.warnings && mapping.warnings.length > 0)
                        .flatMap(mapping => mapping.warnings);
                    element.title = \`⚠️ Advertencias direccionales en mapeos múltiples: \${allWarnings.join('; ')}\`;
                } else {
                    element.classList.remove('warning');
                }

                const multiIndicator = element.querySelector('.multi-color-indicator');
                if (multiIndicator) {
                    multiIndicator.innerHTML = '';
                    const stripeWidth = 100 / fieldMappings.length;

                    fieldMappings.forEach(mapping => {
                        const stripe = document.createElement('div');
                        stripe.className = 'color-stripe';
                        stripe.style.backgroundColor = getColorByIndex(mapping.color);
                        stripe.style.width = \`\${stripeWidth}%\`;
                        multiIndicator.appendChild(stripe);
                    });
                }

                // Usar el color del primer mapeo para el borde (o warning color if has warnings)
                if (hasWarnings) {
                    // Style is handled by CSS warning class
                } else {
                    element.style.borderLeftColor = getColorByIndex(fieldMappings[0].color);
                }

                // Agregar tooltip
                setupTooltip(element, fieldMappings, fieldType);
            }
        }

        function setupTooltip(element, fieldMappings, fieldType) {
            const tooltip = element.querySelector('.mapping-tooltip');
            if (!tooltip) return;

            // Crear contenido del tooltip
            let tooltipContent = \`<strong>\${fieldMappings.length} mapeo(s)</strong><br>\`;

            fieldMappings.forEach((mapping, index) => {
                const typeLabel = mapping.type === '1:1' ? 'Uno a Uno' :
                               mapping.type === '1:N' ? 'Uno a Muchos' : 'Muchos a Uno';

                const color = getColorByIndex(mapping.color);
                tooltipContent += \`<div style="margin: 2px 0; padding: 2px; background: var(--vscode-editor-background); border-radius: 2px;">\`;
                tooltipContent += \`<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: \${color}; margin-right: 4px;"></span>\`;
                tooltipContent += \`<span style="font-size: 10px;">\${typeLabel}</span>\`;
                tooltipContent += \`</div>\`;
            });

            tooltip.innerHTML = tooltipContent;

            // Agregar eventos de hover
            element.addEventListener('mouseenter', (e) => {
                tooltip.style.display = 'block';
                tooltip.style.left = \`\${e.pageX + 10}px\`;
                tooltip.style.top = \`\${e.pageY - 10}px\`;
            });

            element.addEventListener('mouseleave', () => {
                tooltip.style.display = 'none';
            });

            element.addEventListener('mousemove', (e) => {
                if (tooltip.style.display === 'block') {
                    tooltip.style.left = \`\${e.pageX + 10}px\`;
                    tooltip.style.top = \`\${e.pageY - 10}px\`;
                }
            });
        }

        function clearMappings() {
            mappingHistory.push([...mappings]);

            // Liberar todos los colores usados
            mappings.forEach(mapping => {
                if (mapping.color !== undefined) {
                    usedColors.delete(mapping.color);
                }
            });

            mappings = [];
            selectedDtoFields = [];
            selectedDaoFields = [];

            // Limpiar estilos
            document.querySelectorAll('.mapped, .selected').forEach(el => {
                el.classList.remove('mapped', 'selected', 'multi-mapped');

                // Limpiar estilos dinámicos
                el.style.borderLeftColor = '';

                // Limpiar indicadores
                const indicator = el.querySelector('.mapping-indicator');
                if (indicator) {
                    indicator.style.backgroundColor = '';
                }

                const multiIndicator = el.querySelector('.multi-color-indicator');
                if (multiIndicator) {
                    multiIndicator.innerHTML = '';
                }

                const tooltip = el.querySelector('.mapping-tooltip');
                if (tooltip) {
                    tooltip.innerHTML = '';
                    tooltip.style.display = 'none';
                }
            });

            updateStats();
            updateStatus();

            vscode.postMessage({
                command: 'clearMappings'
            });
        }

        function undoMapping() {
            if (mappingHistory.length > 0) {
                // Liberar colores de los mapeos actuales
                mappings.forEach(mapping => {
                    if (mapping.color !== undefined) {
                        releaseColor(mapping.color);
                    }
                });

                // Restaurar mapeos anteriores
                mappings = mappingHistory.pop();

                // Recalcular colores usados
                usedColors.clear();
                mappings.forEach(mapping => {
                    if (mapping.color !== undefined) {
                        usedColors.add(mapping.color);
                    }
                });

                renderDtoFields();
                renderDaoFields();
                markMappedFields();
                updateStats();

                vscode.postMessage({
                    command: 'undoMapping'
                });
            }
        }

        function generateMapstruct() {
            vscode.postMessage({
                command: 'generateMapstruct',
                mappings: mappings
            });
        }

        function filterFields(type) {
            const searchTerm = document.getElementById(type + 'Search').value.toLowerCase();
            const container = document.getElementById(type + 'Container');

            if (type === 'dto') {
                container.querySelectorAll('.field-group').forEach(group => {
                    const fields = group.querySelectorAll('.field-item');
                    let hasVisibleFields = false;

                    fields.forEach(field => {
                        const name = field.querySelector('.field-name').textContent.toLowerCase();
                        const fieldType = field.querySelector('.field-type').textContent.toLowerCase();

                        if (name.includes(searchTerm) || fieldType.includes(searchTerm)) {
                            field.style.display = 'block';
                            hasVisibleFields = true;
                        } else {
                            field.style.display = 'none';
                        }
                    });

                    group.style.display = hasVisibleFields ? 'block' : 'none';
                });
            } else {
                container.querySelectorAll('.dao-field-item').forEach(field => {
                    const name = field.querySelector('.field-name').textContent.toLowerCase();
                    const fieldType = field.querySelector('.field-type').textContent.toLowerCase();

                    field.style.display =
                        name.includes(searchTerm) || fieldType.includes(searchTerm) ? 'block' : 'none';
                });
            }
        }

        function updateStats() {
            const totalMappings = mappings.length;
            const totalFields = Object.values(dtoFields).reduce((total, fields) => total + fields.length, 0);
            const mappedDtoFields = mappings.reduce((total, mapping) => total + mapping.dtoFields.length, 0);

            document.getElementById('mappedCount').textContent = \`Mapeados: \${totalMappings}\`;

            const progress = totalFields > 0 ? Math.round((mappedDtoFields / totalFields) * 100) : 0;
            document.getElementById('progressText').textContent = \`\${progress}% completado\`;
        }

        function updateStatus() {
            const dtoCount = selectedDtoFields.length;
            const daoCount = selectedDaoFields.length;

            let statusText = 'Selecciona campos para crear mapeos';

            if (dtoCount > 0 && daoCount === 0) {
                statusText = \`\${dtoCount} campo(s) DTO seleccionado(s). Selecciona campo(s) DAO para mapear.\`;
            } else if (dtoCount > 0 && daoCount > 0) {
                const type = dtoCount === 1 && daoCount === 1 ? '1:1' :
                           dtoCount === 1 ? '1:N' : 'N:1';
                statusText = \`Creando mapeo \${type}: \${dtoCount} DTO → \${daoCount} DAO\`;
            }

            document.getElementById('statusText').textContent = statusText;
        }
    </script>
</body>
</html>`;
}

/**
 * Genera el contenido HTML para el webview de preview mappings.
 */
function getPreviewWebviewContent(
    dtoFields: GroupedFields,
    daoFields: JavaField[],
    totalDtoFields: number,
    totalDaoFields: number,
    sourceUrl: string
): string {
    const dtoFieldsJson = JSON.stringify(dtoFields);
    const daoFieldsJson = JSON.stringify(daoFields);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MapStruct - Preview Mappings</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            overflow-x: hidden;
        }

        .header {
            background: var(--vscode-panel-background);
            padding: 16px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            font-size: 18px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .source-info {
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 11px;
            margin-bottom: 8px;
            display: inline-block;
        }

        .stats {
            display: flex;
            gap: 20px;
            font-size: 13px;
            color: var(--vscode-descriptionForeground);
        }

        .controls {
            background: var(--vscode-panel-background);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            justify-content: center;
        }

        .btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .btn:hover {
            background: var(--vscode-button-hoverBackground);
        }

        .btn.primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-size: 16px;
            padding: 12px 24px;
        }

        .preview-info {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            text-align: center;
        }

        .main-container {
            display: flex;
            height: calc(100vh - 200px);
        }

        .panel {
            flex: 1;
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-panel-border);
        }

        .panel:last-child {
            border-right: none;
        }

        .panel-header {
            background: var(--vscode-panel-background);
            padding: 12px 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
            font-weight: 600;
            font-size: 14px;
        }

        .fields-container {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
        }

        .field-group {
            margin-bottom: 16px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .group-header {
            background: var(--vscode-panel-background);
            padding: 12px 16px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-weight: 500;
        }

        .group-header:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .group-toggle {
            transition: transform 0.2s;
        }

        .group-toggle.collapsed {
            transform: rotate(-90deg);
        }

        .fields-list {
            background: var(--vscode-editor-background);
        }

        .fields-list.collapsed {
            display: none;
        }

        .field-item {
            padding: 10px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
            position: relative;
        }

        .field-item:last-child {
            border-bottom: none;
        }

        .field-name {
            font-weight: 500;
            margin-bottom: 2px;
        }

        .field-type {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .dao-field-item {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .dao-field-item:last-child {
            border-bottom: none;
        }

        .status-bar {
            background: var(--vscode-statusBar-background);
            color: var(--vscode-statusBar-foreground);
            padding: 8px 20px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>MapStruct - Preview Mappings</h1>
        <div class="source-info">🌐 Datos desde Preview URL</div>
        <div class="stats">
            <span>DTO: ${totalDtoFields} campos</span>
            <span>DAO: ${totalDaoFields} campos</span>
            <span>Fuente: Preview URL</span>
        </div>
    </div>

    <div class="preview-info">
        📡 Datos obtenidos desde: <strong>${sourceUrl}</strong>
    </div>

    <div class="controls">
        <button class="btn primary" onclick="generateMapstruct()">⚡ Generar MapStruct</button>
        <button class="btn" onclick="refreshData()">🔄 Actualizar Datos</button>
    </div>

    <div class="main-container">
        <div class="panel">
            <div class="panel-header">📄 Campos DTO (Preview)</div>
            <div class="fields-container" id="dtoContainer"></div>
        </div>
        <div class="panel">
            <div class="panel-header">🏗️ Campos DAO (Preview)</div>
            <div class="fields-container" id="daoContainer"></div>
        </div>
    </div>

    <div class="status-bar">
        Vista previa de mapeos obtenidos desde URL externa • Solo visualización • Use "Generar MapStruct" para procesar
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Estado global
        let dtoFields = ${dtoFieldsJson};
        let daoFields = ${daoFieldsJson};

        // Inicializar interfaz
        document.addEventListener('DOMContentLoaded', function() {
            renderDtoFields();
            renderDaoFields();
        });

        function renderDtoFields() {
            const container = document.getElementById('dtoContainer');
            container.innerHTML = '';

            for (const [className, fields] of Object.entries(dtoFields)) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'field-group';

                const headerDiv = document.createElement('div');
                headerDiv.className = 'group-header';
                headerDiv.onclick = () => toggleGroup(headerDiv);
                headerDiv.innerHTML = \`
                    <span>\${className} (\${fields.length})</span>
                    <span class="group-toggle">▼</span>
                \`;

                const fieldsDiv = document.createElement('div');
                fieldsDiv.className = 'fields-list';

                fields.forEach(field => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.className = 'field-item';
                    fieldDiv.innerHTML = \`
                        <div class="field-name">\${field.name}</div>
                        <div class="field-type">\${field.type}</div>
                    \`;
                    fieldsDiv.appendChild(fieldDiv);
                });

                groupDiv.appendChild(headerDiv);
                groupDiv.appendChild(fieldsDiv);
                container.appendChild(groupDiv);
            }
        }

        function renderDaoFields() {
            const container = document.getElementById('daoContainer');
            container.innerHTML = '';

            daoFields.forEach(field => {
                const fieldDiv = document.createElement('div');
                fieldDiv.className = 'dao-field-item';
                fieldDiv.innerHTML = \`
                    <div class="field-name">\${field.name}</div>
                    <div class="field-type">\${field.type} <span style="font-size: 11px;">(\${field.className})</span></div>
                \`;
                container.appendChild(fieldDiv);
            });
        }

        function toggleGroup(header) {
            const toggle = header.querySelector('.group-toggle');
            const fieldsList = header.nextElementSibling;

            fieldsList.classList.toggle('collapsed');
            toggle.classList.toggle('collapsed');
        }

        function generateMapstruct() {
            // Simular mapeos automáticos para preview
            const autoMappings = [];

            for (const [className, fields] of Object.entries(dtoFields)) {
                fields.forEach(dtoField => {
                    const matchingDao = daoFields.find(daoField =>
                        daoField.name.toLowerCase() === dtoField.name.toLowerCase()
                    );

                    if (matchingDao) {
                        autoMappings.push({
                            id: Date.now() + Math.random(),
                            dtoFields: [dtoField],
                            daoFields: [matchingDao],
                            type: '1:1',
                            source: 'preview-auto'
                        });
                    }
                });
            }

            vscode.postMessage({
                command: 'generateMapstruct',
                mappings: autoMappings
            });
        }

        function refreshData() {
            vscode.postMessage({
                command: 'refreshData'
            });
        }
    </script>
</body>
</html>`;
}

/**
 * Genera el contenido HTML para el webview de configuración de Preview URL.
 */
function getPreviewInputWebviewContent(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MapStruct - Configuración Preview URL</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: var(--vscode-panel-background);
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
        }

        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header h1 {
            font-size: 24px;
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .header p {
            color: var(--vscode-descriptionForeground);
            font-size: 14px;
        }

        .form-group {
            margin-bottom: 25px;
        }

        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: var(--vscode-foreground);
        }

        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 12px;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            color: var(--vscode-input-foreground);
            font-size: 14px;
            font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--vscode-focusBorder);
            box-shadow: 0 0 0 1px var(--vscode-focusBorder);
        }

        .form-group textarea {
            resize: vertical;
            min-height: 100px;
            font-family: 'Courier New', Consolas, monospace;
        }

        .form-group .help-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }

        .auth-section {
            background: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .checkbox-group {
            display: flex;
            align-items: center;
            margin-bottom: 15px;
        }

        .checkbox-group input[type="checkbox"] {
            width: auto;
            margin-right: 10px;
        }

        .cookies-section {
            display: none;
            margin-top: 15px;
        }

        .cookies-section.visible {
            display: block;
        }

        .buttons {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .btn {
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: background-color 0.2s;
        }

        .btn-primary {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }

        .btn-primary:hover:not(:disabled) {
            background: var(--vscode-button-hoverBackground);
        }

        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        .btn-secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .btn-secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .progress {
            display: none;
            text-align: center;
            padding: 20px;
            background: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
            margin-top: 20px;
        }

        .progress.visible {
            display: block;
        }

        .error {
            display: none;
            padding: 15px;
            background: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            border-radius: 6px;
            margin-top: 20px;
            color: var(--vscode-inputValidation-errorForeground);
        }

        .error.visible {
            display: block;
        }

        .cookie-info {
            background: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px;
            margin-top: 10px;
            border-radius: 0 4px 4px 0;
        }

        .cookie-info h4 {
            margin-bottom: 8px;
            color: var(--vscode-foreground);
        }

        .cookie-info ul {
            margin: 0;
            padding-left: 20px;
        }

        .cookie-info li {
            font-family: 'Courier New', Consolas, monospace;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌐 Configuración Preview URL</h1>
            <p>Configure la conexión para obtener mapeos desde una URL externa</p>
        </div>

        <form id="configForm">
            <div class="form-group">
                <label for="url">URL del Endpoint de Preview *</label>
                <input
                    type="url"
                    id="url"
                    name="url"
                    required
                    placeholder="https://api.ejemplo.com/preview/mappings"
                    autocomplete="off"
                >
                <div class="help-text">Ingresa la URL completa del endpoint que contiene los datos de mapeo</div>
            </div>

            <div class="auth-section">
                <div class="checkbox-group">
                    <input type="checkbox" id="needsAuth" name="needsAuth">
                    <label for="needsAuth">Requiere cookies de autenticación</label>
                </div>

                <div class="cookies-section" id="cookiesSection">
                    <div class="form-group">
                        <label for="cookies">Cookies de Autenticación</label>
                        <textarea
                            id="cookies"
                            name="cookies"
                            placeholder="Pega aquí las cookies en formato: cookie1=valor; cookie2=valor; cookie3=valor"
                            autocomplete="off"
                        ></textarea>
                        <div class="help-text">Se extraerán automáticamente solo las cookies necesarias para la autenticación</div>

                        <div class="cookie-info">
                            <h4>Cookies que se extraerán:</h4>
                            <ul>
                                <li>__Host-GCP_IAP_AUTH_TOKEN_C2D51EA19EA3A213</li>
                                <li>GCP_IAP_UID</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>

            <div class="buttons">
                <button type="button" class="btn btn-secondary" onclick="cancel()">Cancelar</button>
                <button type="submit" class="btn btn-primary" id="submitBtn">Conectar y Obtener Datos</button>
            </div>
        </form>

        <div class="progress" id="progress">
            <div id="progressMessage">🔄 Procesando...</div>
        </div>

        <div class="error" id="error">
            <div id="errorMessage"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();

        // Manejar checkbox de autenticación
        document.getElementById('needsAuth').addEventListener('change', function() {
            const cookiesSection = document.getElementById('cookiesSection');
            if (this.checked) {
                cookiesSection.classList.add('visible');
            } else {
                cookiesSection.classList.remove('visible');
                document.getElementById('cookies').value = '';
            }
        });

        // Manejar envío del formulario
        document.getElementById('configForm').addEventListener('submit', function(e) {
            e.preventDefault();

            const url = document.getElementById('url').value.trim();
            const needsAuth = document.getElementById('needsAuth').checked;
            const cookies = document.getElementById('cookies').value.trim();

            // Validaciones
            if (!url) {
                showError('La URL es requerida');
                return;
            }

            try {
                new URL(url);
            } catch (e) {
                showError('Por favor ingresa una URL válida');
                return;
            }

            if (needsAuth && !cookies) {
                showError('Las cookies son requeridas cuando se habilita la autenticación');
                return;
            }

            // Preparar datos
            const data = {
                url: url,
                needsAuth: needsAuth,
                cookies: needsAuth ? cookies : null
            };

            // Mostrar progreso
            showProgress('🌐 Conectando y obteniendo datos...');

            // Deshabilitar formulario
            document.getElementById('submitBtn').disabled = true;

            // Enviar datos a la extensión
            vscode.postMessage({
                command: 'submitConfig',
                data: data
            });
        });

        // Función para cancelar
        function cancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }

        // Funciones de utilidad
        function showProgress(message) {
            document.getElementById('progressMessage').textContent = message;
            document.getElementById('progress').classList.add('visible');
            document.getElementById('error').classList.remove('visible');
        }

        function showError(message) {
            document.getElementById('errorMessage').textContent = message;
            document.getElementById('error').classList.add('visible');
            document.getElementById('progress').classList.remove('visible');
            document.getElementById('submitBtn').disabled = false;
        }

        function hideMessages() {
            document.getElementById('progress').classList.remove('visible');
            document.getElementById('error').classList.remove('visible');
        }

        // Manejar mensajes desde la extensión
        window.addEventListener('message', event => {
            const message = event.data;

            switch (message.command) {
                case 'showProgress':
                    showProgress(message.message);
                    break;
                case 'showError':
                    showError(message.message);
                    break;
            }
        });

        // Enfocar el campo URL al cargar
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('url').focus();
        });
    </script>
</body>
</html>`;
}

/**
 * Función que se ejecuta cuando la extensión es desactivada.
 */
export function deactivate() {
    console.log('🛑 [DEBUG] Extensión "mapstruct-generator" desactivada');
}

