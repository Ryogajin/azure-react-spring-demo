package com.example.demo.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * ファイル保存リクエストDTO
 * Azure Filesにテキストファイルを保存する際のリクエスト
 */
@Data
public class FileRequest {

    /** ファイル名（必須、拡張子なしで指定） */
    @NotBlank(message = "ファイル名は必須です")
    private String fileName;

    /** ファイルに書き込むテキスト内容（必須） */
    @NotBlank(message = "内容は必須です")
    private String content;
}