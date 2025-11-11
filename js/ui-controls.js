/*
 * MÓDULO DE INTERFAZ DE USUARIO - ui-controls.js
 * 
 * Responsabilidades:
 * - Controles de usuario (botones, selectores, etc.)
 * - Sistema de drag & drop entre listas
 * - Tabla comparativa y actualización de estadísticas
 * - Gestión de la interfaz de divisiones
 * - Actualización de contadores y estados visuales
 */

// =============================================
// INICIALIZACIÓN DE CONTROLES PRINCIPALES
// =============================================

/**
 * CONFIGURA EL BOTÓN DE REESTABLECER (RESET)
 * Restaura el estado inicial de toda la aplicación
 */
function setupResetButton() {
    document.getElementById('reset-btn').addEventListener('click', resetToInitialState);
}

/**
 * CONFIGURA EL SELECTOR DE NÚMERO DE DIVISIONES
 * Maneja cambios en la cantidad de divisiones visibles
 */
function setupDivisionSelector() {
    const selector = document.getElementById('division-count');
    selector.value = currentDivisionCount;
    
    selector.addEventListener('change', function() {
        const newCount = parseInt(this.value);
        if (newCount !== currentDivisionCount) {
            initializeDivisionBoxes(newCount);
            // Si estamos en modo región existente, deseleccionar al cambiar divisiones
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        }
    });
}

/**
 * CONFIGURA EL SELECTOR DE REGIONES EXISTENTES
 * Maneja la carga de secciones electorales y regiones sanitarias
 */
function setupRegionSelector() {
    const selector = document.getElementById('existing-regions');
    
    selector.addEventListener('change', function() {
        const selectedOption = this.value;
        if (selectedOption) {
            loadExistingRegions(selectedOption);
        } else {
            // Si se selecciona la opción por defecto (vacía), restablecer estado
            currentRegionType = null;
        }
    });
}

/**
 * CONFIGURA EL BOTÓN DE POLÍGONO DE SELECCIÓN
 * Activa/desactiva el modo de dibujo de polígonos
 */
function setupPolygonButton() {
    const polygonBtn = document.getElementById('polygon-btn');
    
    polygonBtn.addEventListener('click', function() {
        if (polygonMode) {
            deactivatePolygonMode();
        } else {
            activatePolygonMode();
        }
    });
}

// =============================================
// SISTEMA DE DIVISIONES Y DRAG & DROP
// =============================================

/**
 * INICIALIZA LAS CAJAS DE DIVISIÓN EN LA INTERFAZ
 * Crea dinámicamente las divisiones según el número especificado
 * @param {number} newCount - Nuevo número de divisiones a mostrar
 */
function initializeDivisionBoxes(newCount) {
    const container = document.getElementById('division-boxes-container');
    
    // Guardar el estado actual antes del cambio para posible restauración
    const previousGroups = JSON.parse(JSON.stringify(departmentGroups));
    
    // Si se reducen las divisiones, procesar las que se eliminarán
    if (newCount < currentDivisionCount) {
        processDivisionReduction(newCount, previousGroups);
    }
    
    // Actualizar contador global
    currentDivisionCount = newCount;
    container.innerHTML = '';
    departmentGroups = {};
    
    // Crear nuevas cajas de división
    for (let i = 1; i <= newCount; i++) {
        const color = divisionColors[i - 1] || '#3388ff';
        const defaultName = `División ${i}`;
        departmentGroups[i] = { 
            color: color, 
            departments: [],
            name: defaultName
        };

        const groupBox = document.createElement('div');
        groupBox.className = 'group-box';
        groupBox.setAttribute('data-group-id', i);
        groupBox.style.borderLeft = `4px solid ${color}`;

        groupBox.innerHTML = `
            <h3 class="editable-division-name" contenteditable="true">${defaultName}</h3>
            <div class="group-list" id="division-${i}"></div>
        `;

        container.appendChild(groupBox);
        
        // Configurar nombres editables con eventos
        const editableName = groupBox.querySelector('.editable-division-name');
        editableName.addEventListener('blur', function() {
            departmentGroups[i].name = this.textContent;
            updateComparisonTable();
            // Salir del modo región existente si se edita el nombre
            if (currentRegionType) {
                document.getElementById('existing-regions').value = '';
                currentRegionType = null;
            }
        });
        
        // Permitir Enter para guardar sin salir del campo
        editableName.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.blur();
            }
        });
        
        // Restaurar departamentos si esta división existía antes
        if (previousGroups[i] && previousGroups[i].departments) {
            const divisionList = document.getElementById(`division-${i}`);
            previousGroups[i].departments.forEach(deptName => {
                const dept = allDepartments.find(d => d.properties.nam === deptName);
                const isGBA = dept && gbaCodes.includes(dept.properties.cde);
                
                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = deptName;
                item.setAttribute('data-dept-name', deptName);
                divisionList.appendChild(item);
            });
        }
    }

    // Reiniciar sistema de drag & drop con las nuevas divisiones
    initializeDragAndDrop();
    
    // Actualizar todo el estado de la aplicación
    notifyStateChange();
}

/**
 * PROCESA LA REDUCCIÓN DE DIVISIONES CUANDO SE DISMINUYE EL NÚMERO
 * Preserva las divisiones superiores y elimina las inferiores
 */
function processDivisionReduction(newCount, previousGroups) {
    // Para cada división que será eliminada (números más altos)
    for (let i = newCount + 1; i <= currentDivisionCount; i++) {
        if (previousGroups[i] && previousGroups[i].departments) {
            // Devolver cada departamento al listado principal
            previousGroups[i].departments.forEach(deptName => {
                returnDepartmentToMainList(deptName);
            });
        }
    }
}

/**
 * INICIALIZA EL SISTEMA DE DRAG & DROP CON SORTABLEJS
 * Configura todas las listas (principal y divisiones) para arrastrar elementos
 */
function initializeDragAndDrop() {
    const allDepartmentsList = document.getElementById('all-departments-list');
    const divisionLists = Array.from({length: currentDivisionCount}, (_, i) => 
        document.getElementById(`division-${i + 1}`)
    );

    // Configurar lista principal de departamentos
    Sortable.create(allDepartmentsList, {
        group: {
            name: 'departments',
            pull: 'clone', // Los elementos se clonan al arrastrar desde aquí
            put: true      // Se pueden soltar elementos aquí
        },
        sort: true,        // Permitir reordenamiento interno
        animation: 150,    // Duración de animaciones
        ghostClass: 'dragging', // Clase CSS durante arrastre
        onAdd: function(evt) {
            // Reordenar automáticamente después de agregar elemento
            setTimeout(() => {
                sortMainList();
            }, 100);
        },
        onEnd: function(evt) {
            handleDepartmentMove(evt);
        }
    });

    // Configurar cada lista de división
    divisionLists.forEach((divisionList, index) => {
        if (divisionList) {
            Sortable.create(divisionList, {
                group: {
                    name: 'departamentos',
                    pull: true, // Se pueden sacar elementos
                    put: true   // Se pueden soltar elementos
                },
                animation: 150,
                ghostClass: 'dragging',
                onEnd: function(evt) {
                    handleDepartmentMove(evt);
                }
            });
        }
    });
}

/**
 * MANEJA EL MOVIMIENTO DE DEPARTAMENTOS ENTRE LISTAS
 * Procesa eventos de drag & drop y mueve múltiples departamentos si están seleccionados
 */
function handleDepartmentMove(evt) {
    const draggedItem = evt.item;
    const toElement = evt.to;
    const fromElement = evt.from;

    // Determinar si estamos moviendo un departamento seleccionado
    const hasSelectedDepartments = selectedDepartmentsSet.size > 0;
    const isDraggedItemSelected = draggedItem.classList.contains('selected');

    let departmentsToMove = [];

    // Si el elemento arrastrado está seleccionado Y hay otros seleccionados, mover todos
    if (isDraggedItemSelected && hasSelectedDepartments) {
        departmentsToMove = Array.from(selectedDepartmentsSet);
    } else {
        // Si no, mover solo el departamento arrastrado
        const deptName = draggedItem.getAttribute('data-dept-name');
        departmentsToMove = [deptName];
    }

    // Para cada departamento a mover
    departmentsToMove.forEach(deptName => {
        // Encontrar el elemento en cualquier contenedor
        const element = findDepartmentElement(deptName);
        if (!element) return;

        const currentContainer = element.parentElement;

        // Si el destino es el listado principal
        if (toElement.id === 'all-departments-list') {
            // Mover al listado principal si no está ya allí
            if (currentContainer.id !== 'all-departments-list') {
                toElement.appendChild(element);
            }
            // Asegurar que no esté en ninguna división
            removeDepartmentFromAllDivisions(deptName);
        } 
        // Si el destino es una división
        else {
            // Remover de todas las divisiones (excepto la de destino) y del listado
            removeDepartmentFromAllDivisions(deptName, toElement.id);
            removeDepartmentFromMainList(deptName);
            
            // Mover a la división de destino si no está ya allí
            if (currentContainer.id !== toElement.id) {
                toElement.appendChild(element);
            }
        }
    });

    // Limpiar selección después de mover
    clearAllSelections();

    // Salir del modo región existente si está activo
    if (currentRegionType) {
        document.getElementById('existing-regions').value = '';
        currentRegionType = null;
    }

    // Actualizar todo el estado de la aplicación
    notifyStateChange();
    sortMainList();
}

/**
 * ENCUENTRA UN ELEMENTO DE DEPARTAMENTO POR NOMBRE EN CUALQUIER CONTENEDOR
 * @param {string} deptName - Nombre del departamento a buscar
 * @returns {HTMLElement|null} - Elemento encontrado o null
 */
function findDepartmentElement(deptName) {
    // Buscar en listado principal primero
    const mainList = document.getElementById('all-departments-list');
    const mainItem = mainList.querySelector(`[data-dept-name="${deptName}"]`);
    if (mainItem) return mainItem;

    // Buscar en todas las divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            const divisionItem = divisionList.querySelector(`[data-dept-name="${deptName}"]`);
            if (divisionItem) return divisionItem;
        }
    }

    return null;
}

/**
 * REMUEVE UN DEPARTAMENTO DEL LISTADO PRINCIPAL
 * @param {string} departmentName - Nombre del departamento a remover
 */
function removeDepartmentFromMainList(departmentName) {
    const allItems = document.querySelectorAll('#all-departments-list .department-item');
    allItems.forEach(item => {
        if (item.getAttribute('data-dept-name') === departmentName) {
            item.remove();
        }
    });
}

/**
 * REMUEVE UN DEPARTAMENTO DE TODAS LAS DIVISIONES EXCEPTO LA ESPECIFICADA
 * @param {string} departmentName - Nombre del departamento a remover
 * @param {string} exceptDivisionId - ID de la división a excluir (opcional)
 */
function removeDepartmentFromAllDivisions(departmentName, exceptDivisionId = null) {
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionId = `division-${i}`;
        if (divisionId !== exceptDivisionId) {
            const divisionList = document.getElementById(divisionId);
            if (divisionList) {
                const items = divisionList.querySelectorAll('.department-item');
                items.forEach(item => {
                    if (item.getAttribute('data-dept-name') === departmentName) {
                        item.remove();
                    }
                });
            }
        }
    }
}

/**
 * ACTUALIZA LA ESTRUCTURA INTERNA DE GRUPOS DE DEPARTAMENTOS
 * Sincroniza el objeto departmentGroups con el estado actual del DOM
 */
function updateDepartmentGroups() {
    Object.keys(departmentGroups).forEach(groupId => {
        departmentGroups[groupId].departments = [];
        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            const items = divisionList.querySelectorAll('.department-item');
            items.forEach(item => {
                const deptName = item.getAttribute('data-dept-name');
                if (deptName) {
                    departmentGroups[groupId].departments.push(deptName);
                }
            });
        }
    });
}

/**
 * ORDENA EL LISTADO PRINCIPAL ALFABÉTICAMENTE
 * Mantiene la lista de departamentos siempre ordenada
 */
function sortMainList() {
    const listContainer = document.getElementById('all-departments-list');
    const items = Array.from(listContainer.querySelectorAll('.department-item'));
    
    // Ordenar por nombre del departamento
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir lista ordenada
    listContainer.innerHTML = '';
    items.forEach(item => {
        listContainer.appendChild(item);
    });
}

/**
 * DEVUELVE UN DEPARTAMENTO AL LISTADO PRINCIPAL
 * @param {string} departmentName - Nombre del departamento a devolver
 */
function returnDepartmentToMainList(departmentName) {
    const listContainer = document.getElementById('all-departments-list');
    
    // Recuperar datos completos del departamento
    const dept = allDepartments.find(d => d.properties.nam === departmentName);
    const isGBA = dept && gbaCodes.includes(dept.properties.cde);
    
    // Crear elemento para el listado
    const item = document.createElement('div');
    item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
    item.textContent = departmentName;
    item.setAttribute('data-dept-name', departmentName);
    item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
    
    listContainer.appendChild(item);
    sortMainList();
}

/**
 * POBLA EL LISTADO PRINCIPAL CON TODOS LOS DEPARTAMENTOS
 * @param {Array} features - Array de features GeoJSON con los departamentos
 */
function populateDepartmentsList(features) {
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';
    
    features.forEach(feature => {
        const nombre = feature.properties.nam;
        const codigo = feature.properties.cde;
        const isGBA = gbaCodes.includes(codigo);
        
        const item = document.createElement('div');
        item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
        item.textContent = nombre;
        item.setAttribute('data-dept-name', nombre);
        item.setAttribute('data-dept-code', codigo);
        listContainer.appendChild(item);
    });
}

/**
 * ACTUALIZA EL CONTADOR DE DEPARTAMENTOS RESTANTES EN EL LISTADO
 * Muestra cuántos departamentos quedan disponibles para asignar
 */
function updateRemainingCount() {
    const listContainer = document.getElementById('all-departments-list');
    const remainingCount = listContainer.querySelectorAll('.department-item').length;
    document.getElementById('dept-remaining-count').textContent = remainingCount;
}

// =============================================
// CARGA DE REGIONES EXISTENTES
// =============================================

/**
 * CARGA REGIONES EXISTENTES EN LAS DIVISIONES
 * @param {string} tipoRegion - Tipo de región ('secciones_electorales' o 'regiones_sanitarias')
 */
function loadExistingRegions(tipoRegion) {
    if (!regionesExistentes) {
        console.error('No se cargaron los datos de regiones existentes');
        return;
    }

    // Obtener las regiones según el tipo seleccionado
    const regiones = regionesExistentes[tipoRegion];
    if (!regiones) {
        console.error(`Tipo de región no válido: ${tipoRegion}`);
        return;
    }

    // Guardar el tipo de región actual
    currentRegionType = tipoRegion;

    // Obtener los nombres de las regiones y ordenarlos
    const nombresRegiones = Object.keys(regiones).sort();
    const numeroRegiones = nombresRegiones.length;

    // Actualizar el número de divisiones al número de regiones
    document.getElementById('division-count').value = numeroRegiones;
    initializeDivisionBoxes(numeroRegiones);

    // Limpiar el listado principal (todos los departamentos estarán en divisiones)
    const listContainer = document.getElementById('all-departments-list');
    listContainer.innerHTML = '';

    // Para cada región, asignar los departamentos correspondientes
    nombresRegiones.forEach((nombreRegion, index) => {
        const groupId = index + 1;
        const departamentosRegion = regiones[nombreRegion];

        // Actualizar el nombre de la división
        departmentGroups[groupId].name = nombreRegion;
        const editableName = document.querySelector(`[data-group-id="${groupId}"] .editable-division-name`);
        if (editableName) {
            editableName.textContent = nombreRegion;
        }

        // Obtener el contenedor de la división y limpiarlo
        const divisionList = document.getElementById(`division-${groupId}`);
        if (divisionList) {
            divisionList.innerHTML = '';

            // Agregar cada departamento de la región a la división
            departamentosRegion.forEach(depto => {
                const codigoCde = depto.cde;
                const nombreDepartamento = depto.municipio_nombre;
                const isGBA = gbaCodes.includes(codigoCde);

                const item = document.createElement('div');
                item.className = `department-item ${isGBA ? 'gba-department-bold' : ''}`;
                item.textContent = nombreDepartamento;
                item.setAttribute('data-dept-name', nombreDepartamento);
                item.setAttribute('data-dept-code', codigoCde);
                divisionList.appendChild(item);
            });
        }
    });

    // Actualizar estado completo de la aplicación
    notifyStateChange();
}

// =============================================
// TABLA COMPARATIVA
// =============================================

/**
 * INICIALIZA LA ESTRUCTURA DE LA TABLA COMPARATIVA
 */
function initializeComparisonTable() {
    updateComparisonTable();
}

/**
 * ACTUALIZA LA TABLA COMPARATIVA CON LOS DATOS ACTUALES
 * Muestra cantidad de partidos, superficie, población y densidad por división
 */
function updateComparisonTable() {
    const table = document.getElementById('comparison-table');
    const thead = table.querySelector('thead tr');
    const tbody = table.querySelector('tbody');
    
    // Limpiar tabla existente
    thead.innerHTML = '<th>Variable</th>';
    tbody.innerHTML = '';
    
    // Crear encabezados de columnas con nombres de divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const th = document.createElement('th');
        th.textContent = departmentGroups[i] ? departmentGroups[i].name : `División ${i}`;
        th.style.backgroundColor = departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa';
        th.style.color = getContrastColor(departmentGroups[i] ? departmentGroups[i].color : '#f8f9fa');
        thead.appendChild(th);
    }
    
    // Fila: Cantidad de partidos
    const filaCantidad = document.createElement('tr');
    const celdaVariableCantidad = document.createElement('td');
    celdaVariableCantidad.textContent = 'Cantidad de partidos';
    filaCantidad.appendChild(celdaVariableCantidad);
    
    for (let i = 1; i <= currentDivisionCount; i++) {
        const countCell = document.createElement('td');
        const count = departmentGroups[i] ? departmentGroups[i].departments.length : 0;
        countCell.textContent = count;
        filaCantidad.appendChild(countCell);
    }
    tbody.appendChild(filaCantidad);
    
    // Solo mostrar datos de superficie/población si están cargados
    if (partidosData && partidosData.datos) {
        // Fila: Superficie total
        const filaSuperficie = document.createElement('tr');
        const celdaVariableSuperficie = document.createElement('td');
        celdaVariableSuperficie.textContent = 'Superficie total (km²)';
        filaSuperficie.appendChild(celdaVariableSuperficie);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const superficieCell = document.createElement('td');
            const superficie = calcularTotalDivision(i, 'superficie');
            superficieCell.textContent = formatearNumero(superficie);
            filaSuperficie.appendChild(superficieCell);
        }
        tbody.appendChild(filaSuperficie);
        
        // Fila: Población total
        const filaPoblacion = document.createElement('tr');
        const celdaVariablePoblacion = document.createElement('td');
        celdaVariablePoblacion.textContent = 'Población total';
        filaPoblacion.appendChild(celdaVariablePoblacion);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const poblacionCell = document.createElement('td');
            const poblacion = calcularTotalDivision(i, 'poblacion_total');
            poblacionCell.textContent = formatearNumero(poblacion);
            filaPoblacion.appendChild(poblacionCell);
        }
        tbody.appendChild(filaPoblacion);
        
        // Fila: Densidad poblacional
        const filaDensidad = document.createElement('tr');
        const celdaVariableDensidad = document.createElement('td');
        celdaVariableDensidad.textContent = 'Densidad (hab/km²)';
        filaDensidad.appendChild(celdaVariableDensidad);
        
        for (let i = 1; i <= currentDivisionCount; i++) {
            const densidadCell = document.createElement('td');
            const densidad = calcularDensidadDivision(i);
            densidadCell.textContent = formatearNumero(densidad);
            filaDensidad.appendChild(densidadCell);
        }
        tbody.appendChild(filaDensidad);
    } else {
        // Mensaje mientras se cargan los datos
        const filaMensaje = document.createElement('tr');
        const celdaMensaje = document.createElement('td');
        celdaMensaje.colSpan = currentDivisionCount + 1;
        celdaMensaje.textContent = 'Cargando datos de superficie y población...';
        celdaMensaje.style.textAlign = 'center';
        celdaMensaje.style.fontStyle = 'italic';
        celdaMensaje.style.color = '#666';
        filaMensaje.appendChild(celdaMensaje);
        tbody.appendChild(filaMensaje);
    }
}

/**
 * CALCULA EL COLOR DE CONTRASTE PARA TEXTO SEGÚN FONDO
 * @param {string} hexColor - Color de fondo en formato hexadecimal
 * @returns {string} - '#000000' (negro) o '#FFFFFF' (blanco)
 */
function getContrastColor(hexColor) {
    // Convertir hex a RGB
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    
    // Calcular luminosidad (fórmula de percepción humana)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Retornar negro para fondos claros, blanco para fondos oscuros
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

// =============================================
// FUNCIONES DE SELECCIÓN POR POLÍGONO
// =============================================

/**
 * MUEVE LOS DEPARTAMENTOS SELECCIONADOS AL PRINCIPIO DEL LISTADO PRINCIPAL
 * Asegura que los departamentos seleccionados estén visibles y disponibles
 */
function moveSelectedToMainList() {
    const listContainer = document.getElementById('all-departments-list');
    
    // Limpiar selección anterior
    const previouslySelected = document.querySelectorAll('.department-item.selected');
    previouslySelected.forEach(item => item.classList.remove('selected'));
    
    // Para cada departamento seleccionado
    selectedDepartments.forEach(deptName => {
        // Buscar si ya existe en el listado
        const existingItems = listContainer.querySelectorAll('.department-item');
        let existingItem = null;
        
        existingItems.forEach(item => {
            if (item.getAttribute('data-dept-name') === deptName) {
                existingItem = item;
            }
        });
        
        if (existingItem) {
            // Mover al principio y marcar como seleccionado
            listContainer.insertBefore(existingItem, listContainer.firstChild);
            existingItem.classList.add('selected');
        } else {
            // Crear nuevo elemento si no existe
            const dept = allDepartments.find(d => d.properties.nam === deptName);
            const isGBA = dept && gbaCodes.includes(dept.properties.cde);
            
            const item = document.createElement('div');
            item.className = `department-item ${isGBA ? 'gba-department-bold' : ''} selected`;
            item.textContent = deptName;
            item.setAttribute('data-dept-name', deptName);
            item.setAttribute('data-dept-code', dept ? dept.properties.cde : '');
            
            listContainer.insertBefore(item, listContainer.firstChild);
        }
    });
    
    updateRemainingCount();
}

/**
 * MARCA LOS DEPARTAMENTOS SELECCIONADOS EN LAS DIVISIONES EXISTENTES
 * Aplica la clase 'selected' y los mueve al principio de sus divisiones
 */
function markSelectedInDivisions() {
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            const items = divisionList.querySelectorAll('.department-item');
            items.forEach(item => {
                const deptName = item.getAttribute('data-dept-name');
                if (selectedDepartmentsSet.has(deptName)) {
                    item.classList.add('selected');
                    // Mover al principio de la división
                    divisionList.insertBefore(item, divisionList.firstChild);
                }
            });
        }
    }
}

// =============================================
// RESET Y ESTADO INICIAL
// =============================================

/**
 * RESTABLECE EL ESTADO INICIAL COMPLETO DE LA APLICACIÓN
 * Limpia selecciones, divisiones y vuelve al estado original
 */
function resetToInitialState() {
    // Desactivar modo polígono si está activo
    if (polygonMode) deactivatePolygonMode();
    
    // Limpiar toda la selección
    selectedDepartments = [];
    selectedDepartmentsSet.clear();
    
    // Limpiar selección visual en la interfaz
    document.querySelectorAll('.department-item.selected').forEach(item => {
        item.classList.remove('selected');
    });
    
    // Limpiar todas las divisiones
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) divisionList.innerHTML = '';
        if (departmentGroups[i]) {
            departmentGroups[i].departments = [];
            departmentGroups[i].name = `División ${i}`; // Restaurar nombre por defecto
        }
    }

    // Restaurar listado completo de departamentos
    populateDepartmentsList(allDepartments);

    // Restablecer estilo del mapa a estado inicial
    geoJsonLayer.eachLayer(function(layer) {
        const isGBA = gbaCodes.includes(layer.feature.properties.cde);
        layer.setStyle({
            fillColor: '#3388ff',
            fillOpacity: 0,
            color: '#2c3e50',
            weight: isGBA ? 1.5 : 0.8,
            opacity: 0.8
        });
    });

    // Restablecer controles a valores por defecto
    document.getElementById('division-count').value = 3;
    document.getElementById('existing-regions').value = '';
    currentRegionType = null;
    
    // Reinicializar con 3 divisiones
    initializeDivisionBoxes(3);
}