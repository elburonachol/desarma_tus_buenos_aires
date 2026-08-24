/*
 * MÓDULO DE GESTIÓN DE DIVISIONES
 * 
 * Responsabilidades:
 * - Creación y gestión de las cajas de división
 * - Sistema de drag & drop con redimensionamiento dinámico
 * - Ordenación de listas
 * - Actualización de grupos de departamentos
 */

// =============================================
// SISTEMA DE DIVISIONES
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
            // Ordenar alfabéticamente los departamentos en la división
            sortDivisionList(i);
        }
    }

    // Reiniciar sistema de drag & drop con las nuevas divisiones
    initializeDragAndDrop();
    
    // Actualizar todo el estado de la aplicación
    notifyStateChange();
}

/**
 * ORDENA LOS DEPARTAMENTOS EN UNA DIVISIÓN ALFABÉTICAMENTE
 * @param {number} divisionId - ID de la división a ordenar
 */
function sortDivisionList(divisionId) {
    const divisionList = document.getElementById(`division-${divisionId}`);
    if (!divisionList) return;
    
    const items = Array.from(divisionList.querySelectorAll('.department-item'));
    
    // Ordenar por nombre del departamento
    items.sort((a, b) => {
        const nameA = a.getAttribute('data-dept-name').toUpperCase();
        const nameB = b.getAttribute('data-dept-name').toUpperCase();
        return nameA.localeCompare(nameB);
    });
    
    // Reconstruir lista ordenada
    divisionList.innerHTML = '';
    items.forEach(item => {
        divisionList.appendChild(item);
    });
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
    
    // Ordenar alfabéticamente después de poblar
    sortMainList();
}

/**
 * ACTUALIZA EL CONTADOR DE DEPARTAMENTOS RESTANTES EN EL LISTADO
 * Muestra cuántos elementos quedan disponibles para asignar
 * y el total de elementos según si comunas están incluidas
 */
function updateRemainingCount() {
    const listContainer = document.getElementById('all-departments-list');
    const remainingCount = listContainer.querySelectorAll('.department-item').length;
    
    // Calcular total: 135 departamentos + 15 comunas si están incluidas
    const totalCount = comunasIncluidas ? 150 : 135;
    
    document.getElementById('dept-remaining-count').textContent = remainingCount;
    document.getElementById('dept-total-count').textContent = totalCount;
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

// =============================================
// SISTEMA DE DRAG & DROP CON REDIMENSIONAMIENTO DINÁMICO
// =============================================

/**
 * INICIALIZA EL SISTEMA DE DRAG & DROP CON SORTABLEJS
 * Configura todas las listas (principal y divisiones) para arrastrar elementos
 * con redimensionamiento dinámico
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
            pull: true, // Los elementos se clonan al arrastrar desde aquí
            put: true      // Se pueden soltar elementos aquí
        },
        sort: true,        // Permitir reordenamiento interno
        animation: 150,    // Duración de animaciones
        ghostClass: 'dragging', // Clase CSS durante arrastre
        dragClass: 'dragging-item', // Clase para el elemento que se está arrastrando
        // Cuando se empieza a arrastrar
        onChoose: function(evt) {
            // Comprimir todas las listas
            compressAllLists();
        },
        // Cuando se mueve sobre otro contenedor
        onMove: function(evt) {
            // Expandir el contenedor sobre el que se está moviendo
            const toContainer = evt.to;
            expandContainer(toContainer);
        },
        // Cuando se suelta el elemento
        onUnchoose: function(evt) {
            // Restaurar todos los contenedores a su tamaño original
            restoreAllLists();
        },
        onAdd: function(evt) {
            // Reordenar automáticamente después de agregar elemento
            setTimeout(() => {
                sortMainList();
            }, 100);
        },
        onEnd: function(evt) {
            handleDepartmentMove(evt);
            // Asegurar que se restauren los tamaños
            restoreAllLists();
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
                dragClass: 'dragging-item',
                // Cuando se empieza a arrastrar
                onChoose: function(evt) {
                    // Comprimir todas las listas
                    compressAllLists();
                },
                // Cuando se mueve sobre otro contenedor
                onMove: function(evt) {
                    // Expandir el contenedor sobre el que se está moviendo
                    const toContainer = evt.to;
                    expandContainer(toContainer);
                },
                // Cuando se suelta el elemento
                onUnchoose: function(evt) {
                    // Restaurar todos los contenedores a su tamaño original
                    restoreAllLists();
                },
                onEnd: function(evt) {
                    handleDepartmentMove(evt);
                    // Ordenar la división después del movimiento
                    sortDivisionList(index + 1);
                    // Asegurar que no haya duplicados
                    //removeDuplicatesFromDivision(index + 1);
                    // Asegurar que se restauren los tamaños
                    restoreAllLists();
                }
            });
        }
    });
}

/**
 * COMPRIME TODAS LAS LISTAS (divisiones y listado principal)
 * Se llama cuando comienza el arrastre de un elemento
 */
function compressAllLists() {
    // Comprimir todas las cajas de división
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.parentElement.classList.add('compressed');
        }
    }
    
    // Comprimir listado principal
    const allDepartmentsList = document.getElementById('all-departments-list');
    if (allDepartmentsList) {
        allDepartmentsList.parentElement.classList.add('compressed');
    }
}

/**
 * EXPANDE UN CONTENEDOR ESPECÍFICO
 * Se llama cuando se arrastra un elemento sobre un contenedor
 * @param {HTMLElement} container - El contenedor a expandir
 */
function expandContainer(container) {
    // Primero, restaurar todos los contenedores a su tamaño comprimido
    compressAllLists();
    
    // Luego expandir el contenedor objetivo
    if (container.id === 'all-departments-list') {
        // Es el listado principal
        container.parentElement.classList.remove('compressed');
        container.parentElement.classList.add('expanded');
    } else if (container.id.startsWith('division-')) {
        // Es una división
        container.parentElement.classList.remove('compressed');
        container.parentElement.classList.add('expanded');
    }
}

/**
 * RESTAURA TODAS LAS LISTAS A SU TAMAÑO ORIGINAL
 * Se llama cuando se suelta el elemento arrastrado
 */
function restoreAllLists() {
    // Restaurar todas las cajas de división
    for (let i = 1; i <= currentDivisionCount; i++) {
        const divisionList = document.getElementById(`division-${i}`);
        if (divisionList) {
            divisionList.parentElement.classList.remove('compressed', 'expanded');
        }
    }
    
    // Restaurar listado principal
    const allDepartmentsList = document.getElementById('all-departments-list');
    if (allDepartmentsList) {
        allDepartmentsList.parentElement.classList.remove('compressed', 'expanded');
    }
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
