export interface SubCategory {
    nameEnglish: string;
    nameArabic: string;
    imageUrl: string;
}

export interface Category {
    id: string;
    nameEnglish: string;
    nameArabic: string;
    imageUrl: string;
    subcategories: SubCategory[];
    order: number;
}
