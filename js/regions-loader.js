/*
 * MÓDULO DE CARGA DE REGIONES EXISTENTES
 * 
 * Responsabilidades:
 * - Carga de regiones existentes en las divisiones
 * - Agrupamiento de regiones educativas y departamentos judiciales
 */

// =============================================
// CARGA DE REGIONES EXISTENTES
// =============================================

/**
 * CARGA REGIONES EXISTENTES EN LAS DIVISIONES
 * @param {string} tipoRegion - Tipo de región ('secciones_electorales', 'regiones_sanitarias', 'regiones_educativas', 'deptos_judiciales')
 */
function loadExistingRegions(tipoRegion) {
    if (!regionesExistentes) {
        console.error('No se cargaron los datos de regiones existentes');
        return;
    }

    // Obtener las regiones según el tipo seleccionado
    let regiones = regionesExistentes[tipoRegion];
    if (!regiones) {
        console.error(`Tipo de región no válido: ${tipoRegion}`);
        return;
    }

    // Guardar el tipo de región actual
    currentRegionType = tipoRegion;

    // Si son regiones educativas, aplicar agrupamientos especiales
    if (tipoRegion === 'regiones_educativas') {
        regiones = agruparRegionesEducativas(regiones);
    } else if (tipoRegion === 'deptos_judiciales') {
        regiones = agruparDeptosJudiciales(regiones);
    }

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
            
            // Ordenar alfabéticamente los departamentos en la división
            sortDivisionList(groupId);
        }
    });

    // Actualizar estado completo de la aplicación
    notifyStateChange();

    // Si las comunas estaban incluidas, restaurarlas en el listado y el mapa
    if (comunasIncluidas) {
        showComunas();
    }
}

/**
 * AGRUPA LAS REGIONES EDUCATIVAS SEGÚN LAS ESPECIFICACIONES SOLICITADAS
 * @param {Object} regionesEducativas - Objeto con las regiones educativas originales
 * @returns {Object} - Objeto con las regiones educativas agrupadas
 */
function agruparRegionesEducativas(regionesEducativas) {
    const regionesAgrupadas = {};
    
    // Definir los agrupamientos solicitados
    const agrupamientos = {
        'Regiones educativas 12 y 13': ['12', '13'],
        'Regiones educativas 11 y 6': ['11', '6'],
        'Regiones educativas 7, 8 y 9': ['7', '8', '9'],
        'Regiones educativas 2 y 5': ['2', '5'],
        'Regiones educativas 1 y 4': ['1', '4'],
        'Regiones educativas 20 y 19': ['20', '19'],
        'Regiones educativas 14 y 15': ['14', '15'],
        'Regiones educativas 24 y 25': ['24', '25'],
        'Regiones educativas 17 y 18': ['17', '18']
    };

    // Aplicar los agrupamientos
    Object.keys(agrupamientos).forEach(nombreAgrupado => {
        const regionesIncluidas = agrupamientos[nombreAgrupado];
        regionesAgrupadas[nombreAgrupado] = [];
        
        regionesIncluidas.forEach(regionId => {
            if (regionesEducativas[regionId]) {
                regionesAgrupadas[nombreAgrupado] = regionesAgrupadas[nombreAgrupado].concat(regionesEducativas[regionId]);
            }
        });
        
        // Ordenar alfabéticamente los departamentos dentro del grupo
        regionesAgrupadas[nombreAgrupado].sort((a, b) => {
            return a.municipio_nombre.localeCompare(b.municipio_nombre);
        });
    });

    // Incluir las regiones educativas que no están en ningún agrupamiento
    Object.keys(regionesEducativas).forEach(regionId => {
        let estaIncluida = false;
        Object.values(agrupamientos).forEach(regionesIncluidas => {
            if (regionesIncluidas.includes(regionId)) {
                estaIncluida = true;
            }
        });
        
        if (!estaIncluida) {
            regionesAgrupadas[`Región educativa ${regionId}`] = regionesEducativas[regionId];
        }
    });

    return regionesAgrupadas;
}

/**
 * AGRUPA LOS DEPARTAMENTOS JUDICIALES SEGÚN LAS ESPECIFICACIONES SOLICITADAS
 * @param {Object} deptosJudiciales - Objeto con los departamentos judiciales originales
 * @returns {Object} - Objeto con los departamentos judiciales agrupados
 */
function agruparDeptosJudiciales(deptosJudiciales) {
    const deptosAgrupados = {};
    
    // Definir los agrupamientos solicitados
    const agrupamientos = {
        'Avellaneda - Lanús con Quilmes': ['Avellaneda - Lanús', 'Quilmes'],
        'San Isidro con San Martín': ['San Isidro', 'General San Martín'],
        'Pergamino con San Nicolás': ['Pergamino', 'San Nicolás'],
        'Necochea con Mar del Plata': ['Necochea', 'Mar del Plata'],
        'Moreno - Gral. Rodríguez con Morón': ['Moreno - General Rodríguez', 'Morón']
    };

    // Aplicar los agrupamientos
    Object.keys(agrupamientos).forEach(nombreAgrupado => {
        const deptosIncluidos = agrupamientos[nombreAgrupado];
        deptosAgrupados[nombreAgrupado] = [];
        
        deptosIncluidos.forEach(deptoNombre => {
            if (deptosJudiciales[deptoNombre]) {
                deptosAgrupados[nombreAgrupado] = deptosAgrupados[nombreAgrupado].concat(deptosJudiciales[deptoNombre]);
            }
        });
        
        // Ordenar alfabéticamente los departamentos dentro del grupo
        deptosAgrupados[nombreAgrupado].sort((a, b) => {
            return a.municipio_nombre.localeCompare(b.municipio_nombre);
        });
    });

    // Incluir los departamentos judiciales que no están en ningún agrupamiento
    Object.keys(deptosJudiciales).forEach(deptoNombre => {
        let estaIncluido = false;
        Object.values(agrupamientos).forEach(deptosIncluidos => {
            if (deptosIncluidos.includes(deptoNombre)) {
                estaIncluido = true;
            }
        });
        
        if (!estaIncluido) {
            deptosAgrupados[deptoNombre] = deptosJudiciales[deptoNombre];
        }
    });

    return deptosAgrupados;
}
