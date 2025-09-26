import * as vscode from 'vscode';
import * as path from 'path';

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

        let searchPath = mainPath;

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

    console.log('¡La extensión "mapstruct-generator" está activa!');

    // Registra el comando definido en package.json
    let disposable = vscode.commands.registerCommand('mapstruct-generator.start', async () => {
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
            createEnhancedMappingWebview(context.extensionUri, dtoFields, daoFields);

        } catch (error) {
            vscode.window.showErrorMessage(`Error durante el procesamiento automático: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

function createEnhancedMappingWebview(extensionUri: vscode.Uri, dtoFields: GroupedFields, daoFields: JavaField[]) {
    const panel = vscode.window.createWebviewPanel(
        'enhancedMapstructMapper',
        'Mapeo Avanzado de Campos MapStruct',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'node_modules'), vscode.Uri.joinPath(extensionUri, 'media')]
        }
    );

    panel.webview.html = getEnhancedWebviewContent(panel.webview, extensionUri, dtoFields, daoFields);

    // Manejar mensajes desde el webview
    panel.webview.onDidReceiveMessage(
        message => {
            switch (message.command) {
                case 'generate':
                    vscode.window.showInformationMessage('Mapeos configurados. Generando código MapStruct...');
                    console.log('Mapeos configurados por el usuario:', message.mappings);

                    // TODO: Aquí irá la lógica mejorada para construir el prompt y llamar a la API
                    // const prompt = createAdvancedGeminiPrompt(message.mappings, dtoFields, daoFields);
                    // const generatedCode = await callGeminiAPI(prompt);
                    // showGeneratedCodeInEditor(generatedCode);

                    panel.dispose();
                    return;

                case 'autoMap':
                    // Auto-mapear campos con nombres idénticos
                    const autoMappings = generateAutoMappings(dtoFields, daoFields);
                    panel.webview.postMessage({ command: 'applyAutoMappings', mappings: autoMappings });
                    return;
            }
        },
        undefined,
        []
    );
}

/**
 * Genera mapeos automáticos para campos con nombres idénticos.
 */
function generateAutoMappings(dtoFields: GroupedFields, daoFields: JavaField[]): any[] {
    const autoMappings: any[] = [];

    for (const className of Object.keys(dtoFields)) {
        const fields = dtoFields[className];
        for (const dtoField of fields) {
            // Buscar campo DAO con nombre idéntico
            const matchingDao = daoFields.find(daoField =>
                daoField.name.toLowerCase() === dtoField.name.toLowerCase()
            );

            if (matchingDao) {
                autoMappings.push({
                    dtoClass: className,
                    dtoField: dtoField.name,
                    daoField: matchingDao.name
                });
            }
        }
    }

    return autoMappings;
}

function getEnhancedWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, dtoFields: GroupedFields, daoFields: JavaField[]): string {
    const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(
        extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'
    ));

    // Generar acordeones para cada clase DTO
    const dtoAccordions = Object.keys(dtoFields).map(className => {
        const fields = dtoFields[className];
        const fieldItems = fields.map(field => `
            <div class="dto-field" data-dto-class="${className}" data-dto-field="${field.name}">
                <span class="field-name">${field.name}</span>
                <span class="field-type">(${field.type})</span>
                <div class="connection-point dto-connection" data-field="${field.name}" data-class="${className}"></div>
            </div>
        `).join('');

        return `
            <div class="dto-class-group">
                <div class="class-header" onclick="toggleAccordion('${className}')">
                    <span class="accordion-icon">▼</span>
                    <span class="class-name">${className}</span>
                    <span class="field-count">(${fields.length} campos)</span>
                </div>
                <div class="field-list" id="dto-${className}" style="display: block;">
                    ${fieldItems}
                </div>
            </div>
        `;
    }).join('');

    // Generar lista de campos DAO
    const daoFieldItems = daoFields.map(field => `
        <div class="dao-field" data-dao-field="${field.name}">
            <div class="connection-point dao-connection" data-field="${field.name}"></div>
            <span class="field-name">${field.name}</span>
            <span class="field-type">(${field.type})</span>
            <span class="field-source">de ${field.className}</span>
        </div>
    `).join('');

    return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mapeo Avanzado MapStruct</title>
        <script type="module" src="${toolkitUri}"></script>
        <style>
            * {
                box-sizing: border-box;
            }
            body {
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                padding: 1rem;
                margin: 0;
                background: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }

            .header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 1rem;
                border-bottom: 1px solid var(--vscode-panel-border);
            }

            .header h1 {
                margin: 0;
                color: var(--vscode-titleBar-foreground);
            }

            .controls {
                display: flex;
                gap: 0.5rem;
            }

            .search-container {
                display: flex;
                gap: 1rem;
                margin-bottom: 1rem;
            }

            .search-box {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }

            .search-input {
                padding: 0.5rem;
                border: 1px solid var(--vscode-input-border);
                background: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border-radius: 4px;
            }

            .mapping-container {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                gap: 2rem;
                min-height: 400px;
                position: relative;
            }

            .column {
                border: 1px solid var(--vscode-panel-border);
                border-radius: 8px;
                padding: 1rem;
                background: var(--vscode-sideBar-background);
            }

            .column-title {
                font-weight: bold;
                margin-bottom: 1rem;
                padding-bottom: 0.5rem;
                border-bottom: 1px solid var(--vscode-panel-border);
                color: var(--vscode-titleBar-foreground);
            }

            .dto-class-group {
                margin-bottom: 1rem;
                border: 1px solid var(--vscode-list-inactiveSelectionBackground);
                border-radius: 4px;
                overflow: hidden;
            }

            .class-header {
                background: var(--vscode-list-inactiveSelectionBackground);
                padding: 0.7rem;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                user-select: none;
            }

            .class-header:hover {
                background: var(--vscode-list-hoverBackground);
            }

            .accordion-icon {
                font-size: 0.8rem;
                transition: transform 0.2s;
            }

            .class-name {
                font-weight: bold;
                color: var(--vscode-symbolIcon-classForeground);
            }

            .field-count {
                font-size: 0.9rem;
                opacity: 0.7;
                margin-left: auto;
            }

            .field-list {
                padding: 0.5rem;
                background: var(--vscode-editor-background);
            }

            .dto-field, .dao-field {
                display: flex;
                align-items: center;
                padding: 0.5rem;
                margin: 0.2rem 0;
                border: 1px solid transparent;
                border-radius: 4px;
                cursor: pointer;
                position: relative;
                transition: all 0.2s ease;
            }

            .dto-field:hover, .dao-field:hover {
                background: var(--vscode-list-hoverBackground);
                border-color: var(--vscode-focusBorder);
            }

            .dto-field.connected, .dao-field.connected {
                background: var(--vscode-list-activeSelectionBackground);
                border-color: var(--vscode-button-background);
            }

            .dto-field.selected, .dao-field.selected {
                background: var(--vscode-list-focusBackground);
                border-color: var(--vscode-focusBorder);
                box-shadow: 0 0 8px var(--vscode-focusBorder);
            }

            .dto-field.multi-connected, .dao-field.multi-connected {
                background: var(--vscode-charts-orange);
                border-color: var(--vscode-charts-orange);
                box-shadow: 0 0 4px var(--vscode-charts-orange);
            }

            .field-name {
                font-weight: 500;
                margin-right: 0.5rem;
            }

            .field-type {
                font-size: 0.85rem;
                opacity: 0.7;
                font-style: italic;
            }

            .field-source {
                font-size: 0.8rem;
                margin-left: auto;
                opacity: 0.6;
            }

            .connection-point {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                border: 2px solid var(--vscode-button-background);
                background: var(--vscode-editor-background);
                cursor: pointer;
                transition: all 0.2s ease;
            }

            .dto-connection {
                margin-left: auto;
                margin-right: 0.5rem;
            }

            .dao-connection {
                margin-right: 0.5rem;
            }

            .connection-point:hover {
                background: var(--vscode-button-background);
                transform: scale(1.2);
            }

            .connection-point.active {
                background: var(--vscode-button-background);
                box-shadow: 0 0 8px var(--vscode-button-background);
            }

            .connection-line {
                stroke: var(--vscode-button-background);
                stroke-width: 3;
                fill: none;
                opacity: 0.8;
                transition: all 0.3s ease;
                filter: drop-shadow(0 0 4px var(--vscode-button-background));
            }

            .connection-line.multi {
                stroke: var(--vscode-charts-orange);
                stroke-width: 4;
                filter: drop-shadow(0 0 6px var(--vscode-charts-orange));
            }

            .connection-line.hover {
                opacity: 1;
                stroke-width: 5;
                filter: drop-shadow(0 0 8px currentColor);
            }

            .connection-marker {
                fill: var(--vscode-button-background);
                opacity: 0.9;
            }

            .connection-label {
                font-size: 10px;
                fill: var(--vscode-editor-foreground);
                font-weight: bold;
                text-anchor: middle;
                opacity: 0.8;
            }

            .center-column {
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                background: transparent;
                border: none;
                position: relative;
            }

            .arrow-indicator {
                font-size: 2rem;
                color: var(--vscode-button-background);
                opacity: 0.5;
            }

            .actions {
                margin-top: 2rem;
                display: flex;
                gap: 1rem;
                justify-content: center;
            }

            .stats {
                margin-top: 1rem;
                padding: 1rem;
                background: var(--vscode-panel-background);
                border-radius: 4px;
                text-align: center;
                font-size: 0.9rem;
                opacity: 0.8;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🔄 Mapeo Avanzado de Campos</h1>
            <div class="controls">
                <vscode-button appearance="secondary" id="auto-map-btn">🎯 Auto-mapear</vscode-button>
                <vscode-button appearance="secondary" id="undo-btn" disabled>↶ Deshacer</vscode-button>
                <vscode-button appearance="secondary" id="redo-btn" disabled>↷ Rehacer</vscode-button>
                <vscode-button appearance="secondary" id="export-json-btn">💾 Exportar JSON</vscode-button>
                <vscode-button appearance="secondary" id="clear-btn">🗑️ Limpiar Todo</vscode-button>
            </div>
        </div>

        <div class="search-container">
            <div class="search-box">
                <label>🔍 Buscar en DTOs:</label>
                <input type="text" class="search-input" id="dto-search" placeholder="Filtrar clases y campos DTO...">
            </div>
            <div class="search-box">
                <label>🔍 Buscar en DAOs:</label>
                <input type="text" class="search-input" id="dao-search" placeholder="Filtrar campos DAO...">
            </div>
        </div>

        <div class="mapping-container">
            <div class="column">
                <div class="column-title">📋 Campos DTO</div>
                <div class="dto-fields">
                    ${dtoAccordions}
                </div>
            </div>

            <div class="center-column">
                <div class="arrow-indicator">→</div>
                <svg id="connection-svg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;">
                    <!-- Las líneas de conexión se dibujarán aquí -->
                </svg>
            </div>

            <div class="column">
                <div class="column-title">🗂️ Campos DAO</div>
                <div class="dao-fields">
                    ${daoFieldItems}
                </div>
            </div>
        </div>

        <div class="stats" id="mapping-stats">
            💡 Instrucciones: Haz clic en cualquier campo para seleccionarlo, luego haz clic en el campo objetivo para crear una conexión. Doble clic en una línea para eliminarla.
        </div>

        <div class="actions">
            <vscode-button appearance="primary" id="generate-btn">🚀 Generar Código MapStruct</vscode-button>
        </div>

        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                let mappings = new Map(); // dtoKey -> [daoField1, daoField2, ...]
                let reverseMappings = new Map(); // daoKey -> [dtoKey1, dtoKey2, ...]
                let selectedField = null;
                let connectionCounter = 0;

                // Historial para undo/redo
                let mappingHistory = [];
                let historyIndex = -1;
                const MAX_HISTORY = 50;

                // Elementos principales
                const dtoSearch = document.getElementById('dto-search');
                const daoSearch = document.getElementById('dao-search');
                const autoMapBtn = document.getElementById('auto-map-btn');
                const undoBtn = document.getElementById('undo-btn');
                const redoBtn = document.getElementById('redo-btn');
                const exportJsonBtn = document.getElementById('export-json-btn');
                const clearBtn = document.getElementById('clear-btn');
                const generateBtn = document.getElementById('generate-btn');
                const mappingStats = document.getElementById('mapping-stats');
                const connectionSvg = document.getElementById('connection-svg');

                // Funciones de historial
                function saveToHistory() {
                    // Crear snapshot del estado actual
                    const state = {
                        mappings: new Map(mappings),
                        reverseMappings: new Map(reverseMappings),
                        timestamp: Date.now()
                    };

                    // Limpiar historial futuro si estamos en el medio
                    if (historyIndex < mappingHistory.length - 1) {
                        mappingHistory = mappingHistory.slice(0, historyIndex + 1);
                    }

                    // Agregar nuevo estado
                    mappingHistory.push(state);

                    // Mantener límite de historial
                    if (mappingHistory.length > MAX_HISTORY) {
                        mappingHistory.shift();
                        historyIndex--;
                    }

                    historyIndex = mappingHistory.length - 1;
                    updateHistoryButtons();
                }

                function undo() {
                    if (historyIndex > 0) {
                        historyIndex--;
                        const state = mappingHistory[historyIndex];
                        mappings = new Map(state.mappings);
                        reverseMappings = new Map(state.reverseMappings);
                        updateConnections();
                        drawConnections();
                        updateStats();
                        updateHistoryButtons();
                    }
                }

                function redo() {
                    if (historyIndex < mappingHistory.length - 1) {
                        historyIndex++;
                        const state = mappingHistory[historyIndex];
                        mappings = new Map(state.mappings);
                        reverseMappings = new Map(state.reverseMappings);
                        updateConnections();
                        drawConnections();
                        updateStats();
                        updateHistoryButtons();
                    }
                }

                function updateHistoryButtons() {
                    undoBtn.disabled = historyIndex <= 0;
                    redoBtn.disabled = historyIndex >= mappingHistory.length - 1;
                }

                function removeSpecificMapping(dtoClass, dtoField, daoField) {
                    const dtoKey = \`dto:\${dtoClass}.\${dtoField}\`;
                    const daoKey = \`dao:\${daoField}\`;

                    // Guardar estado antes del cambio
                    saveToHistory();

                    // Remover de mappings
                    if (mappings.has(dtoKey)) {
                        const mappingArray = mappings.get(dtoKey);
                        const filteredArray = mappingArray.filter(m => m.daoField !== daoField);
                        if (filteredArray.length > 0) {
                            mappings.set(dtoKey, filteredArray);
                        } else {
                            mappings.delete(dtoKey);
                        }
                    }

                    // Remover de reverseMappings
                    if (reverseMappings.has(daoKey)) {
                        const dtoKeys = reverseMappings.get(daoKey);
                        const filteredKeys = dtoKeys.filter(key => key !== dtoKey);
                        if (filteredKeys.length > 0) {
                            reverseMappings.set(daoKey, filteredKeys);
                        } else {
                            reverseMappings.delete(daoKey);
                        }
                    }

                    updateConnections();
                    drawConnections();
                    updateStats();
                }

                function exportMappingConfiguration() {
                    // Obtener todos los campos DTO disponibles
                    const allDtoFields = [];
                    document.querySelectorAll('.dto-field').forEach(field => {
                        allDtoFields.push({
                            className: field.dataset.dtoClass,
                            fieldName: field.dataset.dtoField,
                            fieldType: field.querySelector('.field-type').textContent.replace(/[()]/g, ''),
                            mapped: false,
                            mappedTo: []
                        });
                    });

                    // Obtener todos los campos DAO disponibles
                    const allDaoFields = [];
                    document.querySelectorAll('.dao-field').forEach(field => {
                        allDaoFields.push({
                            fieldName: field.dataset.daoField,
                            fieldType: field.querySelector('.field-type').textContent.replace(/[()]/g, ''),
                            sourceClass: field.querySelector('.field-source').textContent.replace('de ', ''),
                            mapped: false,
                            mappedFrom: []
                        });
                    });

                    // Aplicar mapeos a los campos DTO
                    mappings.forEach((mappingArray, dtoKey) => {
                        const [, classAndField] = dtoKey.split(':');
                        const [className, fieldName] = classAndField.split('.');

                        const dtoField = allDtoFields.find(f =>
                            f.className === className && f.fieldName === fieldName
                        );

                        if (dtoField) {
                            dtoField.mapped = true;
                            dtoField.mappedTo = mappingArray.map(m => ({
                                daoField: m.daoField,
                                mappingType: mappingArray.length > 1 ? 'one-to-many' : 'one-to-one'
                            }));
                        }
                    });

                    // Aplicar mapeos a los campos DAO
                    reverseMappings.forEach((dtoKeys, daoKey) => {
                        const daoFieldName = daoKey.replace('dao:', '');
                        const daoField = allDaoFields.find(f => f.fieldName === daoFieldName);

                        if (daoField) {
                            daoField.mapped = true;
                            daoField.mappedFrom = dtoKeys.map(dtoKey => {
                                const [, classAndField] = dtoKey.split(':');
                                const [className, fieldName] = classAndField.split('.');
                                return {
                                    dtoClass: className,
                                    dtoField: fieldName,
                                    mappingType: dtoKeys.length > 1 ? 'many-to-one' : 'one-to-one'
                                };
                            });
                        }
                    });

                    // Crear el JSON final
                    const mappingConfig = {
                        metadata: {
                            generatedAt: new Date().toISOString(),
                            totalDtoFields: allDtoFields.length,
                            totalDaoFields: allDaoFields.length,
                            mappedDtoFields: allDtoFields.filter(f => f.mapped).length,
                            mappedDaoFields: allDaoFields.filter(f => f.mapped).length,
                            totalConnections: Array.from(mappings.values()).reduce((sum, arr) => sum + arr.length, 0)
                        },
                        dtoFields: allDtoFields,
                        daoFields: allDaoFields,
                        mappingSummary: {
                            oneToOne: [],
                            oneToMany: [],
                            manyToOne: []
                        }
                    };

                    // Clasificar mapeos por tipo
                    mappings.forEach((mappingArray, dtoKey) => {
                        const [, classAndField] = dtoKey.split(':');
                        const [className, fieldName] = classAndField.split('.');

                        mappingArray.forEach(mapping => {
                            const mappingInfo = {
                                dtoClass: className,
                                dtoField: fieldName,
                                daoField: mapping.daoField
                            };

                            if (mappingArray.length === 1) {
                                const daoKey = \`dao:\${mapping.daoField}\`;
                                const reverseMappingCount = reverseMappings.get(daoKey)?.length || 0;

                                if (reverseMappingCount === 1) {
                                    mappingConfig.mappingSummary.oneToOne.push(mappingInfo);
                                } else {
                                    mappingConfig.mappingSummary.manyToOne.push(mappingInfo);
                                }
                            } else {
                                mappingConfig.mappingSummary.oneToMany.push(mappingInfo);
                            }
                        });
                    });

                    return mappingConfig;
                }

                // Funcionalidad de búsqueda
                dtoSearch.addEventListener('input', (e) => {
                    filterFields('.dto-field', '.dto-class-group', e.target.value);
                });

                daoSearch.addEventListener('input', (e) => {
                    filterFields('.dao-field', null, e.target.value);
                });

                function filterFields(selector, groupSelector, searchTerm) {
                    const fields = document.querySelectorAll(selector);
                    const term = searchTerm.toLowerCase();

                    fields.forEach(field => {
                        const fieldName = field.querySelector('.field-name').textContent.toLowerCase();
                        const className = field.dataset.dtoClass || '';
                        const matches = fieldName.includes(term) || className.toLowerCase().includes(term);

                        field.style.display = matches ? 'flex' : 'none';
                    });

                    // Ocultar grupos DTO vacíos
                    if (groupSelector) {
                        document.querySelectorAll(groupSelector).forEach(group => {
                            const visibleFields = group.querySelectorAll(selector + ':not([style*="display: none"])');
                            group.style.display = visibleFields.length > 0 ? 'block' : 'none';
                        });
                    }
                }

                // Funcionalidad de acordeón
                window.toggleAccordion = function(className) {
                    const fieldList = document.getElementById('dto-' + className);
                    const icon = document.querySelector(\`[onclick="toggleAccordion('\${className}')"] .accordion-icon\`);

                    if (fieldList.style.display === 'none') {
                        fieldList.style.display = 'block';
                        icon.textContent = '▼';
                        icon.style.transform = 'rotate(0deg)';
                    } else {
                        fieldList.style.display = 'none';
                        icon.textContent = '▶';
                        icon.style.transform = 'rotate(-90deg)';
                    }
                };

                // Funcionalidad de mapeo bidireccional
                document.addEventListener('click', (e) => {
                    if (e.target.classList.contains('dto-connection') || e.target.closest('.dto-field')) {
                        handleFieldClick(e.target.closest('.dto-field'), 'dto');
                    } else if (e.target.classList.contains('dao-connection') || e.target.closest('.dao-field')) {
                        handleFieldClick(e.target.closest('.dao-field'), 'dao');
                    } else {
                        clearSelection();
                    }
                });

                function handleFieldClick(fieldElement, fieldType) {
                    const fieldKey = getFieldKey(fieldElement, fieldType);

                    if (!selectedField) {
                        // Primera selección
                        clearSelection();
                        fieldElement.classList.add('selected');
                        selectedField = { element: fieldElement, type: fieldType, key: fieldKey };
                        updateStats();
                    } else if (selectedField.key === fieldKey) {
                        // Deseleccionar el mismo campo
                        clearSelection();
                    } else {
                        // Segunda selección - crear conexión
                        createConnection(selectedField, { element: fieldElement, type: fieldType, key: fieldKey });
                        clearSelection();
                        updateStats();
                    }
                }

                function getFieldKey(fieldElement, fieldType) {
                    if (fieldType === 'dto') {
                        return \`dto:\${fieldElement.dataset.dtoClass}.\${fieldElement.dataset.dtoField}\`;
                    } else {
                        return \`dao:\${fieldElement.dataset.daoField}\`;
                    }
                }

                function createConnection(field1, field2) {
                    let dtoField, daoField;

                    // Determinar qué campo es DTO y cuál es DAO
                    if (field1.type === 'dto') {
                        dtoField = field1;
                        daoField = field2;
                    } else {
                        dtoField = field2;
                        daoField = field1;
                    }

                    // Verificar que tengamos un DTO y un DAO
                    if (dtoField.type !== 'dto' || daoField.type !== 'dao') {
                        alert('Debes conectar un campo DTO con un campo DAO');
                        return;
                    }

                    // Guardar estado antes del cambio
                    saveToHistory();

                    const dtoKey = dtoField.key;
                    const daoKey = daoField.key;
                    const daoFieldName = daoField.element.dataset.daoField;
                    const dtoInfo = {
                        class: dtoField.element.dataset.dtoClass,
                        field: dtoField.element.dataset.dtoField
                    };

                    // Verificar si la conexión ya existe
                    if (mappings.has(dtoKey)) {
                        const existingMappings = mappings.get(dtoKey);
                        if (existingMappings.some(m => m.daoField === daoFieldName)) {
                            alert('Esta conexión ya existe');
                            return;
                        }
                    }

                    // Agregar mapeo DTO -> DAO (puede ser 1:N)
                    if (!mappings.has(dtoKey)) {
                        mappings.set(dtoKey, []);
                    }
                    const dtoMappings = mappings.get(dtoKey);
                    dtoMappings.push({
                        dtoClass: dtoInfo.class,
                        dtoField: dtoInfo.field,
                        daoField: daoFieldName
                    });

                    // Agregar mapeo reverso DAO -> DTO (puede ser N:1)
                    if (!reverseMappings.has(daoKey)) {
                        reverseMappings.set(daoKey, []);
                    }
                    const daoMappings = reverseMappings.get(daoKey);
                    if (!daoMappings.includes(dtoKey)) {
                        daoMappings.push(dtoKey);
                    }

                    updateConnections();
                    drawConnections();
                }

                function clearSelection() {
                    document.querySelectorAll('.dto-field, .dao-field').forEach(f => {
                        f.classList.remove('selected');
                    });
                    selectedField = null;
                }

                function updateConnections() {
                    // Limpiar todas las clases de conexión
                    document.querySelectorAll('.dto-field, .dao-field').forEach(f => {
                        f.classList.remove('connected', 'multi-connected');
                    });

                    // Aplicar estilos basados en el número de conexiones
                    mappings.forEach((mappingArray, dtoKey) => {
                        mappingArray.forEach(mapping => {
                            const dtoElement = document.querySelector(\`[data-dto-class="\${mapping.dtoClass}"][data-dto-field="\${mapping.dtoField}"]\`);
                            if (dtoElement) {
                                if (mappingArray.length > 1) {
                                    dtoElement.classList.add('multi-connected');
                                } else {
                                    dtoElement.classList.add('connected');
                                }
                            }
                        });
                    });

                    reverseMappings.forEach((dtoKeys, daoKey) => {
                        const daoFieldName = daoKey.replace('dao:', '');
                        const daoElement = document.querySelector(\`[data-dao-field="\${daoFieldName}"]\`);
                        if (daoElement) {
                            if (dtoKeys.length > 1) {
                                daoElement.classList.add('multi-connected');
                            } else {
                                daoElement.classList.add('connected');
                            }
                        }
                    });
                }

                function drawConnections() {
                    // Limpiar SVG de conexiones existentes
                    connectionSvg.innerHTML = '';

                    // Definir marcadores para las flechas
                    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
                    marker.setAttribute('id', 'arrowhead');
                    marker.setAttribute('markerWidth', '10');
                    marker.setAttribute('markerHeight', '7');
                    marker.setAttribute('refX', '9');
                    marker.setAttribute('refY', '3.5');
                    marker.setAttribute('orient', 'auto');

                    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                    polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
                    polygon.setAttribute('class', 'connection-marker');

                    marker.appendChild(polygon);
                    defs.appendChild(marker);
                    connectionSvg.appendChild(defs);

                    // Dibujar líneas de conexión
                    mappings.forEach((mappingArray, dtoKey) => {
                        mappingArray.forEach((mapping, index) => {
                            const dtoElement = document.querySelector(\`[data-dto-class="\${mapping.dtoClass}"][data-dto-field="\${mapping.dtoField}"]\`);
                            const daoElement = document.querySelector(\`[data-dao-field="\${mapping.daoField}"]\`);

                            if (dtoElement && daoElement) {
                                drawConnectionLine(dtoElement, daoElement, mappingArray.length > 1, index);
                            }
                        });
                    });
                }

                function drawConnectionLine(dtoElement, daoElement, isMulti, index) {
                    const dtoRect = dtoElement.getBoundingClientRect();
                    const daoRect = daoElement.getBoundingClientRect();
                    const svgRect = connectionSvg.getBoundingClientRect();

                    // Calcular posiciones relativas al SVG
                    const startX = dtoRect.right - svgRect.left;
                    const startY = dtoRect.top + dtoRect.height / 2 - svgRect.top;
                    const endX = daoRect.left - svgRect.left;
                    const endY = daoRect.top + daoRect.height / 2 - svgRect.top;

                    // Añadir offset vertical para conexiones múltiples
                    const offsetY = isMulti ? (index - 0.5) * 8 : 0;
                    const adjustedStartY = startY + offsetY;
                    const adjustedEndY = endY + offsetY;

                    // Crear puntos de control para curva Bezier
                    const controlX1 = startX + (endX - startX) * 0.3;
                    const controlX2 = startX + (endX - startX) * 0.7;

                    // Crear path SVG
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const pathData = \`M \${startX} \${adjustedStartY} C \${controlX1} \${adjustedStartY}, \${controlX2} \${adjustedEndY}, \${endX} \${adjustedEndY}\`;

                    path.setAttribute('d', pathData);
                    path.setAttribute('class', isMulti ? 'connection-line multi' : 'connection-line');
                    path.setAttribute('marker-end', 'url(#arrowhead)');

                    // Agregar etiqueta si hay múltiples conexiones
                    if (isMulti) {
                        const midX = (startX + endX) / 2;
                        const midY = (adjustedStartY + adjustedEndY) / 2;

                        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                        label.setAttribute('x', midX);
                        label.setAttribute('y', midY - 5);
                        label.setAttribute('class', 'connection-label');
                        label.textContent = index + 1;

                        connectionSvg.appendChild(label);
                    }

                    // Eventos para hover
                    path.addEventListener('mouseenter', () => {
                        path.classList.add('hover');
                        dtoElement.style.boxShadow = '0 0 12px var(--vscode-focusBorder)';
                        daoElement.style.boxShadow = '0 0 12px var(--vscode-focusBorder)';
                    });

                    path.addEventListener('mouseleave', () => {
                        path.classList.remove('hover');
                        dtoElement.style.boxShadow = '';
                        daoElement.style.boxShadow = '';
                    });

                    // Doble click para eliminar conexión
                    path.addEventListener('dblclick', () => {
                        if (confirm('¿Eliminar esta conexión?')) {
                            removeSpecificMapping(mapping.dtoClass, mapping.dtoField, mapping.daoField);
                        }
                    });

                    connectionSvg.appendChild(path);
                }


                function updateStats() {
                    const totalDtoFields = document.querySelectorAll('.dto-field').length;
                    const mappedDtoFields = mappings.size;
                    const totalConnections = Array.from(mappings.values()).reduce((sum, arr) => sum + arr.length, 0);

                    let statusText = \`📊 Estado: \${mappedDtoFields} de \${totalDtoFields} campos DTO mapeados (\${totalConnections} conexiones)\`;

                    if (selectedField) {
                        if (selectedField.type === 'dto') {
                            const dtoInfo = \`\${selectedField.element.dataset.dtoClass}.\${selectedField.element.dataset.dtoField}\`;
                            statusText += \` | 🎯 DTO seleccionado: \${dtoInfo}\`;
                        } else {
                            statusText += \` | 🎯 DAO seleccionado: \${selectedField.element.dataset.daoField}\`;
                        }
                        statusText += \` - Haz clic en el campo objetivo para crear conexión\`;
                    } else {
                        statusText += \` | ✋ Haz clic en un campo para comenzar el mapeo\`;
                    }

                    mappingStats.innerHTML = statusText;
                }

                // Eventos de botones
                autoMapBtn.addEventListener('click', () => {
                    vscode.postMessage({ command: 'autoMap' });
                });

                undoBtn.addEventListener('click', () => {
                    undo();
                });

                redoBtn.addEventListener('click', () => {
                    redo();
                });

                exportJsonBtn.addEventListener('click', () => {
                    const mappingConfig = exportMappingConfiguration();

                    // Enviar JSON al backend para guardarlo
                    vscode.postMessage({
                        command: 'exportJson',
                        data: mappingConfig
                    });
                });

                clearBtn.addEventListener('click', () => {
                    if (confirm('¿Estás seguro de que deseas limpiar todas las conexiones?')) {
                        saveToHistory();
                        mappings.clear();
                        reverseMappings.clear();
                        updateConnections();
                        drawConnections();
                        clearSelection();
                        updateStats();
                    }
                });

                generateBtn.addEventListener('click', () => {
                    if (mappings.size === 0) {
                        alert('Debe configurar al menos un mapeo antes de generar el código.');
                        return;
                    }

                    // Convertir mappings a formato plano para enviar
                    const flatMappings = [];
                    mappings.forEach((mappingArray) => {
                        flatMappings.push(...mappingArray);
                    });

                    vscode.postMessage({
                        command: 'generate',
                        mappings: flatMappings
                    });
                });

                // Redimensionar conexiones cuando cambie el tamaño de la ventana
                let resizeTimeout;
                window.addEventListener('resize', () => {
                    clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        if (mappings.size > 0) {
                            drawConnections();
                        }
                    }, 150);
                });

                // Escuchar mensajes del backend
                window.addEventListener('message', event => {
                    const message = event.data;
                    switch (message.command) {
                        case 'applyAutoMappings':
                            message.mappings.forEach(mapping => {
                                const dtoKey = \`dto:\${mapping.dtoClass}.\${mapping.dtoField}\`;
                                const daoKey = \`dao:\${mapping.daoField}\`;

                                // Agregar al mapeo principal
                                if (!mappings.has(dtoKey)) {
                                    mappings.set(dtoKey, []);
                                }
                                const dtoMappings = mappings.get(dtoKey);
                                if (!dtoMappings.some(m => m.daoField === mapping.daoField)) {
                                    dtoMappings.push(mapping);
                                }

                                // Agregar al mapeo reverso
                                if (!reverseMappings.has(daoKey)) {
                                    reverseMappings.set(daoKey, []);
                                }
                                const daoMappings = reverseMappings.get(daoKey);
                                if (!daoMappings.includes(dtoKey)) {
                                    daoMappings.push(dtoKey);
                                }
                            });

                            updateConnections();
                            drawConnections();
                            updateStats();
                            break;
                    }
                });

                // Observer para redibujar conexiones cuando cambie el DOM
                const observer = new MutationObserver((mutations) => {
                    let shouldRedraw = false;
                    mutations.forEach((mutation) => {
                        if (mutation.type === 'childList' ||
                            (mutation.type === 'attributes' &&
                             (mutation.attributeName === 'style' || mutation.attributeName === 'class'))) {
                            shouldRedraw = true;
                        }
                    });

                    if (shouldRedraw && mappings.size > 0) {
                        setTimeout(() => drawConnections(), 50);
                    }
                });

                observer.observe(document.querySelector('.mapping-container'), {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    attributeFilter: ['style', 'class']
                });

                // Atajos de teclado
                document.addEventListener('keydown', (e) => {
                    // Ctrl+Z para deshacer
                    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        undo();
                    }
                    // Ctrl+Shift+Z o Ctrl+Y para rehacer
                    else if ((e.ctrlKey && e.shiftKey && e.key === 'Z') || (e.ctrlKey && e.key === 'y')) {
                        e.preventDefault();
                        redo();
                    }
                    // Escape para limpiar selección
                    else if (e.key === 'Escape') {
                        clearSelection();
                        updateStats();
                    }
                    // Ctrl+S para exportar JSON
                    else if (e.ctrlKey && e.key === 's') {
                        e.preventDefault();
                        exportJsonBtn.click();
                    }
                });

                // Inicializar
                updateStats();
                updateHistoryButtons();

                // Guardar estado inicial
                setTimeout(() => {
                    saveToHistory();
                }, 100);
            })();
        </script>
    </body>
    </html>`;
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, dtoFields: JavaField[], daoFields: JavaField[]): string {
    // Obtener la URI del script del toolkit de VS Code
    const toolkitUri = webview.asWebviewUri(vscode.Uri.joinPath(
        extensionUri, 'node_modules', '@vscode', 'webview-ui-toolkit', 'dist', 'toolkit.js'
    ));

    // Opciones para los desplegables (los campos del DAO + una opción para omitir)
    const daoOptions = [
        { name: '--- Omitir este campo ---', value: '' },
        ...daoFields.map(f => ({ name: f.name, value: f.name }))
    ];

    // Generar las filas de la tabla de mapeo
    const mappingRows = dtoFields.map(dtoField => `
        <tr>
            <td>${dtoField.name}</td>
            <td>&rarr;</td>
            <td>
                <vscode-dropdown data-dto-field="${dtoField.name}" style="width: 100%;">
                    ${daoOptions.map(daoOption => `
                        <vscode-option value="${daoOption.value}" ${daoOption.name === dtoField.name ? 'selected' : ''}>
                            ${daoOption.name}
                        </vscode-option>
                    `).join('')}
                </vscode-dropdown>
            </td>
        </tr>
    `).join('');

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-p">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mapeo de Campos MapStruct</title>
        <script type="module" src="${toolkitUri}"></script>
        <style>
            body {
                padding: 1rem;
            }
            table {
                width: 100%;
                border-collapse: collapse;
            }
            th, td {
                padding: 0.5rem;
                text-align: left;
            }
            td:nth-child(2) {
                text-align: center;
            }
            vscode-button {
                margin-top: 1rem;
                width: 100%;
            }
        </style>
    </head>
    <body>
        <h1>Mapeo de DTO a DAO</h1>
        <p>Selecciona el campo del DAO correspondiente para cada campo del DTO. Los campos con nombres idénticos ya están seleccionados.</p>
        
        <table>
            <thead>
                <tr>
                    <th>Campo DTO</th>
                    <th></th>
                    <th>Campo DAO</th>
                </tr>
            </thead>
            <tbody>
                ${mappingRows}
            </tbody>
        </table>

        <vscode-button id="generate-btn">Generar Código MapStruct</vscode-button>

        <script>
            (function() {
                const vscode = acquireVsCodeApi();
                const generateBtn = document.getElementById('generate-btn');

                generateBtn.addEventListener('click', () => {
                    const dropdowns = document.querySelectorAll('vscode-dropdown');
                    const mappings = [];
                    dropdowns.forEach(dropdown => {
                        const dtoField = dropdown.dataset.dtoField;
                        const daoField = dropdown.value;
                        if (dtoField && daoField) {
                            mappings.push({ dtoField, daoField });
                        }
                    });

                    vscode.postMessage({
                        command: 'generate',
                        mappings: mappings
                    });
                });
            }())
        </script>
    </body>
    </html>`;
}


// This function is called when your extension is deactivated
export function deactivate() {}