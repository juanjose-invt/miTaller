export interface Source {
  id: string;
  org: string;
  title: string;
  url: string;
  lang: 'es' | 'en';
}

export interface Tip {
  id: string;
  area: 'soldadura' | 'carpinteria';
  category: string;
  level: 'basico' | 'intermedio';
  title: string;
  body: string;
  sourceIds: string[];
}

/** Ensamble de carpintería sin tornillos (tradición occidental o japonesa). */
export interface Joint {
  id: string;
  /** Nombre en español: «Caja y espiga». */
  name: string;
  /** Nombre original si es una técnica japonesa, en rōmaji: «Ari-tsugi». */
  nameOriginal?: string;
  tradition: 'occidental' | 'japonesa';
  difficulty: 1 | 2 | 3;
  /** Qué es y cómo trabaja, 2–4 frases. */
  description: string;
  /** Dónde usarlo: «Unir pata y travesaño de una mesa». */
  uses: string[];
  /** Pasos resumidos de ejecución. */
  how: string[];
  tools: string[];
  /** ¿Necesita cola? */
  glue: 'si' | 'no' | 'opcional';
  sourceIds: string[];
}
