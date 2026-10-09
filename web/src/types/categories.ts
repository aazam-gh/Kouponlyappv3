export interface SubCategory {
    nameEnglish: string;
    imageUrl: string;
}

export interface Category {
    id: string;
    nameEnglish: string;
    imageUrl: string;
    subcategories: SubCategory[];
    order: number;
}
