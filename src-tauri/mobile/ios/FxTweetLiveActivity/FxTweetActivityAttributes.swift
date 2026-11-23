//
//  FxTweetActivityAttributes.swift
//  FxTwitter Archive Studio - by Hikaproj
//  iOS 16+ ActivityKit Live Activity & Dynamic Island Attributes
//

import ActivityKit
import WidgetKit
import SwiftUI

public struct FxTweetActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        public var tweetsCount: UInt64
        public var mediaCount: UInt64
        public var totalBytes: UInt64
        public var speedText: String
        public var statusText: String
        public var progressPct: Double
        public var isLocked: Bool
        
        public init(
            tweetsCount: UInt64,
            mediaCount: UInt64,
            totalBytes: UInt64,
            speedText: String,
            statusText: String,
            progressPct: Double,
            isLocked: Bool
        ) {
            self.tweetsCount = tweetsCount
            self.mediaCount = mediaCount
            self.totalBytes = totalBytes
            self.speedText = speedText
            self.statusText = statusText
            self.progressPct = progressPct
            self.isLocked = isLocked
        }
    }

    public var handle: String
    public var author: String

    public init(handle: String, author: String = "Hikaproj") {
        self.handle = handle
        self.author = author
    }
}
