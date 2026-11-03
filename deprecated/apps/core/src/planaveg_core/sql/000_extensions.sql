-- Extensões e o único SRS que o planaveg_core registra.
-- PostGIS registra geometry_columns automaticamente (tabelas tipadas + views).
CREATE EXTENSION IF NOT EXISTS postgis;

-- SRS 100000 do GeoPackage Planaveg 2026: Albers IBGE (SIRGAS 2000). É o CRS das peças
-- recebidas e da geometria canônica (geom_albers), onde a carga mede os hectares; as
-- cópias de mapa ficam em EPSG:4674. O número é local do GeoPackage, não código EPSG: o
-- `inspect` confere os parâmetros do WKT, e o `init-db` confere que o proj4 daqui é o do
-- contrato.
INSERT INTO spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text)
SELECT
    100000,
    'GPKG_PLANAVEG',
    100000,
    'PROJCS["IBGE_South_America_Albers_Equal_Area_Conic",GEOGCS["SIRGAS 2000",DATUM["Sistema_de_Referencia_Geocentrico_para_las_AmericaS_2000",SPHEROID["GRS 1980",6378137,298.257222101,AUTHORITY["EPSG","7019"]],AUTHORITY["EPSG","6674"]],PRIMEM["Greenwich",0],UNIT["Degree",0.0174532925199433]],PROJECTION["Albers_Conic_Equal_Area"],PARAMETER["latitude_of_center",-12],PARAMETER["longitude_of_center",-54],PARAMETER["standard_parallel_1",-2],PARAMETER["standard_parallel_2",-22],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH]]',
    '+proj=aea +lat_0=-12 +lon_0=-54 +lat_1=-2 +lat_2=-22 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs +type=crs'
WHERE NOT EXISTS (SELECT 1 FROM spatial_ref_sys WHERE srid = 100000);
