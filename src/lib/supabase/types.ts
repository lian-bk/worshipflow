// Hand-written types matching supabase/migrations/0001_schema.sql.
//
// Once your Supabase project is linked with the Supabase CLI, you can replace
// this whole file by running:
//   npx supabase gen types typescript --project-id <your-project-ref> > src/lib/supabase/types.ts
// which generates it automatically from the live database instead of by hand.

export type LicenseStatus = "unused" | "active" | "expired" | "revoked";
export type TeamRole = "hotu" | "bawmtu" | "member";
export type RosterStatus = "draft" | "published";
export type AssignmentResponse = "pending" | "accepted" | "declined";
export type AccountStatus = "invited" | "active" | "no_login";
export type ServiceTypePattern = "weekly" | "dates";
export type SlideLabelType =
  | "verse"
  | "chorus"
  | "prechorus"
  | "bridge"
  | "intro"
  | "outro"
  | "tag"
  | "other";
export type MediaStorageSource = "supabase" | "local_reference";
export type PptxConversionStatus = "pending" | "processing" | "complete" | "failed";

export interface Database {
  public: {
    Tables: {
      license_plans: {
        Row: {
          plan_code: string;
          label: string;
          duration_in_days: number | null;
          created_at: string;
        };
        Insert: {
          plan_code: string;
          label: string;
          duration_in_days?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["license_plans"]["Insert"]>;
        Relationships: [];
      };
      license_keys: {
        Row: {
          id: string;
          key_code: string;
          plan_code: string;
          issued_to_email: string;
          church_id: string | null;
          status: LicenseStatus;
          created_at: string;
          activated_at: string | null;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          key_code: string;
          plan_code: string;
          issued_to_email: string;
          church_id?: string | null;
          status?: LicenseStatus;
          created_at?: string;
          activated_at?: string | null;
          expires_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["license_keys"]["Insert"]>;
        Relationships: [];
      };
      churches: {
        Row: {
          id: string;
          name: string;
          contact_email: string;
          language_code: string;
          license_key_id: string | null;
          hotu_label: string;
          bawmtu_label: string;
          tagline: string;
          roster_footer_text: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_email: string;
          language_code?: string;
          license_key_id?: string | null;
          hotu_label?: string;
          bawmtu_label?: string;
          tagline?: string;
          roster_footer_text?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["churches"]["Insert"]>;
        Relationships: [];
      };
      live_show_state: {
        Row: {
          occurrence_id: string;
          church_id: string;
          token: string;
          church_name: string;
          tagline: string;
          payload: unknown;
          updated_at: string;
        };
        Insert: {
          occurrence_id: string;
          church_id: string;
          token?: string;
          church_name?: string;
          tagline?: string;
          payload?: unknown;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["live_show_state"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          auth_user_id: string | null;
          church_id: string | null;
          email: string | null;
          full_name: string | null;
          is_owner: boolean;
          is_church_admin: boolean;
          account_status: AccountStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          church_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          is_owner?: boolean;
          is_church_admin?: boolean;
          account_status?: AccountStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: {
          id: string;
          team_id: string;
          user_id: string;
          role: TeamRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          user_id: string;
          role?: TeamRole;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_members"]["Insert"]>;
        Relationships: [];
      };
      team_positions: {
        Row: {
          id: string;
          team_id: string;
          label: string;
          display_order: number;
        };
        Insert: {
          id?: string;
          team_id: string;
          label: string;
          display_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["team_positions"]["Insert"]>;
        Relationships: [];
      };
      service_types: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          pattern_type: ServiceTypePattern;
          default_weekday: number | null;
          default_start_time: string | null;
          default_location: string | null;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          pattern_type?: ServiceTypePattern;
          default_weekday?: number | null;
          default_start_time?: string | null;
          default_location?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["service_types"]["Insert"]>;
        Relationships: [];
      };
      service_occurrences: {
        Row: {
          id: string;
          service_type_id: string | null;
          roster_id: string | null;
          date: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          service_type_id?: string | null;
          roster_id?: string | null;
          date: string;
          note?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["service_occurrences"]["Insert"]>;
        Relationships: [];
      };
      rosters: {
        Row: {
          id: string;
          team_id: string;
          month: number;
          year: number;
          status: RosterStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          team_id: string;
          month: number;
          year: number;
          status?: RosterStatus;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["rosters"]["Insert"]>;
        Relationships: [];
      };
      roster_assignments: {
        Row: {
          id: string;
          roster_id: string;
          service_occurrence_id: string;
          team_position_id: string;
          user_id: string | null;
          response: AssignmentResponse;
          created_at: string;
        };
        Insert: {
          id?: string;
          roster_id: string;
          service_occurrence_id: string;
          team_position_id: string;
          user_id?: string | null;
          response?: AssignmentResponse;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roster_assignments"]["Insert"]>;
        Relationships: [];
      };
      roster_notes: {
        Row: {
          id: string;
          roster_id: string;
          service_occurrence_id: string;
          note: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          roster_id: string;
          service_occurrence_id: string;
          note: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["roster_notes"]["Insert"]>;
        Relationships: [];
      };
      songs: {
        Row: {
          id: string;
          church_id: string;
          title: string;
          lyrics: string | null;
          theme_id: string | null;
          lang: string;
          musical_key: string | null;
          songbook_number: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          title: string;
          lyrics?: string | null;
          theme_id?: string | null;
          lang?: string;
          musical_key?: string | null;
          songbook_number?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["songs"]["Insert"]>;
        Relationships: [];
      };
      media_assets: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          storage_path: string | null;
          kind: string | null;
          storage_source: MediaStorageSource;
          external_reference: string | null;
          pptx_conversion_status: PptxConversionStatus | null;
          source_media_id: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          storage_path?: string | null;
          kind?: string | null;
          storage_source?: MediaStorageSource;
          external_reference?: string | null;
          pptx_conversion_status?: PptxConversionStatus | null;
          source_media_id?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["media_assets"]["Insert"]>;
        Relationships: [];
      };
      song_slides: {
        Row: {
          id: string;
          song_id: string;
          label_type: SlideLabelType;
          label_number: number | null;
          custom_label: string | null;
          content: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          song_id: string;
          label_type?: SlideLabelType;
          label_number?: number | null;
          custom_label?: string | null;
          content?: string;
          display_order?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["song_slides"]["Insert"]>;
        Relationships: [];
      };
      arrangements: {
        Row: {
          id: string;
          song_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          song_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["arrangements"]["Insert"]>;
        Relationships: [];
      };
      arrangement_items: {
        Row: {
          id: string;
          arrangement_id: string;
          song_slide_id: string;
          display_order: number;
        };
        Insert: {
          id?: string;
          arrangement_id: string;
          song_slide_id: string;
          display_order?: number;
        };
        Update: Partial<Database["public"]["Tables"]["arrangement_items"]["Insert"]>;
        Relationships: [];
      };
      themes: {
        Row: {
          id: string;
          church_id: string | null;
          name: string;
          background_color: string;
          background_image_path: string | null;
          font_family: string;
          text_color: string;
          is_starter: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id?: string | null;
          name: string;
          background_color?: string;
          background_image_path?: string | null;
          font_family?: string;
          text_color?: string;
          is_starter?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["themes"]["Insert"]>;
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          church_id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          church_id: string;
          name: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tags"]["Insert"]>;
        Relationships: [];
      };
      song_tags: {
        Row: {
          song_id: string;
          tag_id: string;
        };
        Insert: {
          song_id: string;
          tag_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["song_tags"]["Insert"]>;
        Relationships: [];
      };
      media_tags: {
        Row: {
          media_asset_id: string;
          tag_id: string;
        };
        Insert: {
          media_asset_id: string;
          tag_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["media_tags"]["Insert"]>;
        Relationships: [];
      };
      service_items: {
        Row: {
          id: string;
          church_id: string;
          service_occurrence_id: string | null;
          title: string;
          item_type: string;
          display_order: number;
          song_id: string | null;
          arrangement_id: string | null;
          media_asset_id: string | null;
        };
        Insert: {
          id?: string;
          church_id: string;
          service_occurrence_id?: string | null;
          title: string;
          item_type?: string;
          display_order?: number;
          song_id?: string | null;
          arrangement_id?: string | null;
          media_asset_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["service_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      redeem_license_key: {
        Args: {
          p_key_code: string;
          p_church_name: string;
          p_contact_email: string;
          p_language_code: string;
          p_user_id: string;
          p_user_email: string;
          p_full_name: string;
        };
        Returns: { church_id: string }[];
      };
      current_church_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_owner: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_church_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      is_team_leader: {
        Args: { p_team_id: string };
        Returns: boolean;
      };
      respond_to_assignment: {
        Args: { p_assignment_id: string; p_response: string };
        Returns: undefined;
      };
    };
    Enums: {
      license_status: LicenseStatus;
      team_role: TeamRole;
      roster_status: RosterStatus;
      assignment_response: AssignmentResponse;
      slide_label_type: SlideLabelType;
    };
    CompositeTypes: Record<string, never>;
  };
}
