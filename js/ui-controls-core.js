/*
 * MÓDULO DE INTERFAZ DE USUARIO - CORE
 * 
 * Responsabilidades:
 * - Controles de usuario principales (botones, selectores, etc.)
 * - Gestión del estado de la aplicación (reset)
 * - Funciones de selección por polígono
 * - Funciones auxiliares de búsqueda
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
// FUNCIONES AUXILIARES DE BÚSQUEDA
// =============================================

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
    
    // Limpiar regionalizaciones visibles
    if (typeof clearRegionalizaciones === 'function') {
        clearRegionalizaciones();
    }
    
    // Reinicializar con 3 divisiones
    initializeDivisionBoxes(3);
}