import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

export interface Categoria { id: string; nombre: string; }
export interface Marca { id: string; nombre: string; categoriaId: string; meta?: number; }
export interface Venta { id?: string; fecha: string; monto: number; cantidad: number; marcaId: string; categoriaId: string; }

@Injectable({
    providedIn: 'root'
})

export class ApiService {
    private baseUrl = 'http://localhost:3000/api';

    constructor(private http: HttpClient){ }

    getConfig(): Observable<{categorias: Categoria[], marcas: Marca[]}> {
        return this.http.get<{categorias: Categoria[], marcas: Marca[]}>(`${this.baseUrl}/config`);
    }

    getVentas(): Observable<Venta[]> {
        return this.http.get<Venta[]>(`${this.baseUrl}/ventas`);
    }

    addVenta(venta: Venta): Observable<any> {
        return this.http.post(`${this.baseUrl}/ventas`, venta);
    }

    updateMeta(marcaId: string, meta: number): Observable<any> {
        return this.http.put(`${this.baseUrl}/marcas/${marcaId}/meta`, { meta });
    }
}
