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
                    'Generar mapeos desde una URL de preview (próximamente)',
                    vscode.TreeItemCollapsibleState.None,
                    'mapstruct-generator.mapFromPreview',
                    new vscode.ThemeIcon('globe'),
                    false
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

    // Registrar comandos deshabilitados (placeholder para futuras funcionalidades)
    let mapFromPreviewDisposable = vscode.commands.registerCommand('mapstruct-generator.mapFromPreview', async () => {
        console.log('🎯 [DEBUG] Comando mapFromPreview ejecutado (placeholder)');
        vscode.window.showInformationMessage('🚧 Funcionalidad en desarrollo: Mapear con Preview URL');
    });

    let mapFromImagesDisposable = vscode.commands.registerCommand('mapstruct-generator.mapFromImages', async () => {
        console.log('🎯 [DEBUG] Comando mapFromImages ejecutado (placeholder)');
        vscode.window.showInformationMessage('🚧 Funcionalidad en desarrollo: Mapear con imágenes');
    });

    console.log('📋 [DEBUG] Todos los comandos registrados correctamente');

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

            // 5. Extraer campos DAO
            const daoFields = await extractDaoFields(businessPath, selectedModelFolder);
            if (daoFields.length === 0) {
                vscode.window.showWarningMessage('No se encontraron campos DAO con anotación @Campo en la carpeta seleccionada.');
                return;
            }

            // 6. Crear y mostrar el Webview mejorado
            createEnhancedMappingWebview(context, context.extensionUri, dtoFields, daoFields);

        } catch (error) {
            vscode.window.showErrorMessage(`Error durante el procesamiento automático: ${error}`);
        }
    }

    // Registrar comandos en el contexto
    context.subscriptions.push(disposable, mapFromProjectDisposable, mapFromPreviewDisposable, mapFromImagesDisposable);

    console.log('📋 [DEBUG] Extensión "mapstruct-generator" completamente activada');
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
        message => {
            switch (message.command) {
                case 'clearMappings':
                    vscode.window.showInformationMessage('Mapeos limpiados');
                    break;
                case 'undoMapping':
                    vscode.window.showInformationMessage('Último mapeo deshecho');
                    break;
                case 'generateMapstruct':
                    generateMapstructConfig(message.mappings);
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
function generateMapstructConfig(mappings: any[]) {
    console.log('🔧 [DEBUG] Generando configuración MapStruct...');
    console.log('📋 [DEBUG] Mapeos recibidos:', JSON.stringify(mappings, null, 2));

    // TODO: Integrar con API para generar código MapStruct real
    const jsonOutput = {
        timestamp: new Date().toISOString(),
        totalMappings: mappings.length,
        mappings: mappings
    };

    console.log('📄 [DEBUG] JSON generado:', JSON.stringify(jsonOutput, null, 2));
    vscode.window.showInformationMessage(`MapStruct generado con ${mappings.length} mapeos. Ver consola para detalles.`);
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

        function createMapping() {
            if (selectedDtoFields.length > 0 && selectedDaoFields.length > 0) {
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
                    color: uniqueColor
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

                // Aplicar color dinámicamente
                element.style.borderLeftColor = color;

                const indicator = element.querySelector('.mapping-indicator');
                if (indicator) {
                    indicator.style.backgroundColor = color;
                }

                // Agregar tooltip
                setupTooltip(element, fieldMappings, fieldType);
            } else {
                // Mapeos múltiples - usar indicador multicolor
                element.classList.add('multi-mapped');

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

                // Usar el color del primer mapeo para el borde
                element.style.borderLeftColor = getColorByIndex(fieldMappings[0].color);

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
 * Función que se ejecuta cuando la extensión es desactivada.
 */
export function deactivate() {
    console.log('🛑 [DEBUG] Extensión "mapstruct-generator" desactivada');
}

