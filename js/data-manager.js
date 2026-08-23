/*
 * MÓDULO DE GESTIÓN DE DATOS - data-manager.js
 * 
 * Responsabilidades:
 * - Carga de datos externos (GeoJSON, datos_partidos.json, regiones_administrativas.json)
 * - Cálculos matemáticos y estadísticos
 * - Búsquedas y filtros en los datos
 * - Procesamiento de información para la tabla comparativa
 */

// =============================================
// CARGA DE DATOS EXTERNOS
// =============================================

/**
 * CARGA DEL ARCHIVO GEOJSON DESDE geometrias/deptos_pba.geojson
 * Carga todos los departamentos y los prepara para su uso en la aplicación
 */
function loadGeoJSON() {
    return fetch('geometrias/deptos_pba.geojson')
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
            
            return allDepartments;
        })
        .catch(error => {
            console.error('❌ Error cargando el GeoJSON:', error);
            alert('Error al cargar el archivo GeoJSON. Verifica la consola para más detalles.');
            throw error; // Relanzar para que Promise.all falle apropiadamente
        });
}

/**
 * CARGA DEL ARCHIVO GEOJSON DE COMUNAS DESDE geometrias/comunas_caba_c_datos.geojson
 * Carga las 15 comunas de CABA para su uso en la aplicación
 * Nota: Este archivo tiene la misma estructura de datos que deptos_pba.geojson
 */
function loadComunasCABA() {
    return fetch('geometrias/comunas_caba_c_datos.geojson')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error al cargar comunas: HTTP ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log(`✅ Comunas CABA cargadas: ${data.features.length} comunas`);
            console.log('📍 Comunas cargadas:', data.features.map(f => f.properties.nam));
            
            // Guardar todas las comunas
            comunasCABA = data.features;
            
            // Ordenar alfabéticamente como los departamentos
            comunasCABA.sort((a, b) => {
                const nameA = (a.properties.nam || '').toUpperCase();
                const nameB = (b.properties.nam || '').toUpperCase();
                return nameA.localeCompare(nameB);
            });

            return comunasCABA;
        })
        .catch(error => {
            console.error('❌ Error cargando comunas CABA:', error);
            // No bloqueamos la aplicación si falla la carga de comunas
            return null;
        });
}

/**
 * CARGA DE DATOS DE PARTIDOS DESDE tablas_de_atributos/datos_partidos.json
 * Incluye superficie, población y otras variables para cálculos
 */
function loadPartidosData() {
    return fetch('tablas_de_atributos/datos_partidos.json')
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
 * CARGA DE REGIONES ADMINISTRATIVAS DESDE tablas_de_atributos/regiones_administrativas.json
 * Incluye secciones electorales, regiones sanitarias, regiones educativas y departamentos judiciales
 */
function loadRegionesExistentes() {
    return fetch('tablas_de_atributos/regiones_administrativas.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            regionesExistentes = data;
            console.log('✅ Regiones administrativas cargadas:', regionesExistentes);
            return regionesExistentes;
        })
        .catch(error => {
            console.error('❌ Error cargando regiones administrativas:', error);
            // No bloqueamos la aplicación si falla la carga de estos datos
            return null;
        });
}

/**
 * CARGA DE DATOS DE COMUNAS DESDE tablas_de_atributos/datos_comunas.json
 * Incluye superficie y población de las comunas de CABA para cálculos
 */
let datosComuna = null;

function loadDatosComuna() {
    return fetch('tablas_de_atributos/datos_comunas.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            datosComuna = data;
            console.log('✅ Datos de comunas cargados:', datosComuna);
            return datosComuna;
        })
        .catch(error => {
            console.error('❌ Error cargando datos de comunas:', error);
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
    // Buscar en departamentos de PBA
    const dept = allDepartments.find(d => d.properties.nam === nombreDepartamento);
    if (dept) {
        // Usar cde_num (sin cero)
        return dept.properties.cde_num || null;
    }
    // Buscar en comunas de CABA
    const comuna = comunasCABA.find(c => c.properties.nam === nombreDepartamento);
    if (comuna) {
        return comuna.properties.cde_num || null;
    }
    return null;
}

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

// =============================================
// FUNCIONES AUXILIARES PARA GESTIÓN DE DATOS
// =============================================

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

/**
 * CALCULA EL TOTAL DE UNA VARIABLE PARA TODOS LOS DEPARTAMENTOS Y COMUNAS DE UNA DIVISIÓN
 * @param {number} grupoId - ID de la división (1, 2, 3, ...)
 * @param {string} variable - Nombre de la variable a sumar ('superficie', 'poblacion_total', etc.)
 * @returns {number} - Suma total de la variable para la división
 */
function calcularTotalDivision(grupoId, variable) {
    // Verificar que tenemos datos cargados
    if (!partidosData || !partidosData.datos) {
        return 0;
    }
    
    const elementosEnGrupo = departmentGroups[grupoId].departments;
    let total = 0;
    let elementosConDatos = 0;
    
    // Sumar la variable para cada elemento (departamento o comuna) en la división
    elementosEnGrupo.forEach(nombreElemento => {
    const codigo = obtenerCodigoCdePorNombre(nombreElemento);
    if (codigo) {
        // Primero intentar con datos de partidos (PBA)
        if (partidosData.datos[codigo] && partidosData.datos[codigo][variable] !== undefined) {
            total += partidosData.datos[codigo][variable];
            elementosConDatos++;
        }
        // Si no, intentar con datos de comunas (CABA)
        else if (datosComuna && datosComuna.datos[codigo] && datosComuna.datos[codigo][variable] !== undefined) {
            total += datosComuna.datos[codigo][variable];
            elementosConDatos++;
        }
    }
});
    
    // Solo retornar total si encontramos datos para al menos un elemento
    return elementosConDatos > 0 ? total : 0;
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
