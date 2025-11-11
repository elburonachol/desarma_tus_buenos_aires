/*
 * MÓDULO DE GESTIÓN DE DATOS - data-manager.js
 * 
 * Responsabilidades:
 * - Carga de datos externos (GeoJSON, datos_partidos.json, regiones_existentes.json)
 * - Cálculos matemáticos y estadísticos
 * - Búsquedas y filtros en los datos
 * - Procesamiento de información para la tabla comparativa
 */

// =============================================
// CARGA DE DATOS EXTERNOS
// =============================================

/**
 * CARGA DEL ARCHIVO GEOJSON DESDE PBA.geojson
 * Carga todos los departamentos y los prepara para su uso en la aplicación
 */
function loadGeoJSON() {
    return fetch('PBA.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al cargar el archivo GeoJSON');
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ GeoJSON cargado: ${data.features.length} departamentos`);

            // Guardar todos los features (departamentos) para uso global
            allDepartments = data.features;

            // Ordenar alfabéticamente por nombre para consistencia
            allDepartments.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            // Crear la capa GeoJSON en el mapa usando funciones del módulo de mapa
            geoJsonLayer = L.geoJSON(allDepartments, {
                style: getDepartmentStyle,
                onEachFeature: setupDepartmentInteractions
            }).addTo(map);

            // Ajustar la vista del mapa para mostrar todos los departamentos
            setTimeout(() => {
                map.fitBounds(geoJsonLayer.getBounds(), { padding: [20, 20] });
            }, 100);

            // Poblar el listado de departamentos en la interfaz
            populateDepartmentsList(allDepartments);

            // Actualizar contador total de departamentos
            document.getElementById('dept-count').textContent = allDepartments.length;

            return allDepartments;
        })
        .catch(error => {
            console.error('❌ Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
            throw error; // Relanzar para que Promise.all falle apropiadamente
        });
}

/**
 * CARGA DE DATOS DE PARTIDOS DESDE datos/datos_partidos.json
 * Incluye superficie, población y otras variables para cálculos
 */
function loadPartidosData() {
    return fetch('datos/datos_partidos.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            partidosData = data;
            console.log('✅ Datos de partidos cargados:', partidosData);
            console.log(`📊 Variables disponibles: ${Object.keys(partidosData.variables)}`);
            return partidosData;
        })
        .catch(error => {
            console.error('❌ Error cargando datos de partidos:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

/**
 * CARGA DE REGIONES EXISTENTES DESDE regiones/regiones_existentes.json
 * Incluye secciones electorales y regiones sanitarias predefinidas
 */
function loadRegionesExistentes() {
    return fetch('regiones/regiones_existentes.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            regionesExistentes = data;
            console.log('✅ Regiones existentes cargadas:', regionesExistentes);
            return regionesExistentes;
        })
        .catch(error => {
            console.error('❌ Error cargando regiones existentes:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

// =============================================
// CÁLCULOS Y PROCESAMIENTO DE DATOS
// =============================================

/**
 * OBTIENE EL CÓDIGO CDE DE UN DEPARTAMENTO POR SU NOMBRE
 * @param {string} nombreDepartamento - Nombre del departamento a buscar
 * @returns {string|null} - Código CDE o null si no se encuentra
 */
function obtenerCodigoCdePorNombre(nombreDepartamento) {
    const departamento = allDepartments.find(dept => dept.properties.nam === nombreDepartamento);
    return departamento ? departamento.properties.cde : null;
}

/**
 * CALCULA EL TOTAL DE UNA VARIABLE PARA TODOS LOS DEPARTAMENTOS DE UNA DIVISIÓN
 * @param {number} grupoId - ID de la división (1, 2, 3, ...)
 * @param {string} variable - Nombre de la variable a sumar ('superficie', 'poblacion_total', etc.)
 * @returns {number} - Suma total de la variable para la división
 */
function calcularTotalDivision(grupoId, variable) {
    // Verificar que tenemos datos cargados
    if (!partidosData || !partidosData.datos) {
        return 0;
    }
    
    const partidosEnGrupo = departmentGroups[grupoId].departments;
    let total = 0;
    let partidosConDatos = 0;
    
    // Sumar la variable para cada departamento en la división
    partidosEnGrupo.forEach(nombrePartido => {
        const codigoCde = obtenerCodigoCdePorNombre(nombrePartido);
        if (codigoCde && partidosData.datos[codigoCde] && partidosData.datos[codigoCde][variable]) {
            total += partidosData.datos[codigoCde][variable];
            partidosConDatos++;
        }
    });
    
    // Solo retornar total si encontramos datos para al menos un departamento
    return partidosConDatos > 0 ? total : 0;
}

/**
 * CALCULA LA DENSIDAD POBLACIONAL PARA UNA DIVISIÓN
 * @param {number} grupoId - ID de la división
 * @returns {string} - Densidad formateada con 1 decimal
 */
function calcularDensidadDivision(grupoId) {
    const poblacion = calcularTotalDivision(grupoId, 'poblacion_total');
    const superficie = calcularTotalDivision(grupoId, 'superficie');
    
    // Evitar división por cero y retornar densidad calculada
    if (superficie > 0 && poblacion > 0) {
        return (poblacion / superficie).toFixed(1);
    }
    return '0.0';
}

/**
 * FORMATEA NÚMEROS CON SEPARADORES DE MILES PARA MEJOR LEGIBILIDAD
 * @param {number|string} numero - Número a formatear
 * @returns {string} - Número formateado con separadores de miles
 */
function formatearNumero(numero) {
    if (numero === 0 || numero === '0') return '0';
    if (!numero) return '-';
    
    return numero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// =============================================
// FUNCIONES AUXILIARES PARA GESTIÓN DE DATOS
// =============================================

/**
 * OBTIENE UN DEPARTAMENTO COMPLETO POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {Object|null} - Departamento encontrado o null
 */
function getDepartmentByCode(cde) {
    return allDepartments.find(dept => dept.properties.cde === cde);
}

/**
 * OBTIENE EL NOMBRE DE UN DEPARTAMENTO POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {string|null} - Nombre del departamento o null
 */
function getDepartmentNameByCode(cde) {
    const dept = getDepartmentByCode(cde);
    return dept ? dept.properties.nam : null;
}

/**
 * VERIFICA SI UN DEPARTAMENTO PERTENECE AL GBA POR SU CÓDIGO CDE
 * @param {string} cde - Código CDE del departamento
 * @returns {boolean} - True si pertenece al GBA
 */
function isGBADepartmentByCode(cde) {
    return gbaCodes.includes(cde);
}