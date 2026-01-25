import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface Categoria { id: string; nombre: string; }
export interface Marca { id: string; nombre: string; categoriaId: string; }

export interface DesempenoMes {
  marcaId: string;
  anio: number;
  mes: number;
  ventaReal: number;
  unidades: number;
  meta: number;
}

export interface CambioDesempeno {
  marcaId: string;
  nombreMarca: string;
  anio: number;
  mes: number;
  ventaReal: number;
  unidades: number;
  meta: number;
}

export interface HistorialLog {
  id?: string;
  fecha: string;
  marca: string;
  mesAfectado: number;
  campo: string;
  valorAnterior: number;
  valorNuevo: number;
}

@Injectable({
  providedIn: 'root'
})

export class ApiService {
  private baseUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient){ }

  getConfig(): Observable<{categorias: Categoria[], marcas: Marca[]}> {
    return this.http.get<{categorias: Categoria[], marcas: Marca[]}>(`${this.baseUrl}/config`);
  }

  getDesempeno(anio: number): Observable<DesempenoMes[]> {
    return this.http.get<DesempenoMes[]>(`${this.baseUrl}/desempeno?anio=${anio}`);
  }

  saveDesempenoBatch(cambios: CambioDesempeno[]): Observable<any> {
    return this.http.post(`${this.baseUrl}/desempeno/batch`, { cambios });
  }

  getHistorial(): Observable<HistorialLog[]> {
    return this.http.get<HistorialLog[]>(`${this.baseUrl}/historial`);
  }
}
