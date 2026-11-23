//
//  LiveActivityBridge.swift
//  FxTwitter Archive Studio - by Hikaproj
//  C / Rust FFI Bridge for ActivityKit Live Activities
//

import Foundation
import ActivityKit

@available(iOS 16.1, *)
@objc public class LiveActivityManager: NSObject {
    @objc public static let shared = LiveActivityManager()
    
    private var currentActivity: Activity<FxTweetActivityAttributes>?

    @objc public func start(handle: String) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
        
        let attributes = FxTweetActivityAttributes(handle: handle)
        let initialContentState = FxTweetActivityAttributes.ContentState(
            tweetsCount: 0,
            mediaCount: 0,
            totalBytes: 0,
            speedText: "0.0 tw/s",
            statusText: "Initializing...",
            progressPct: 0.0,
            isLocked: false
        )
        
        do {
            let activity = try Activity.request(
                attributes: attributes,
                content: .init(state: initialContentState, staleDate: nil),
                pushType: nil
            )
            self.currentActivity = activity
        } catch {
            print("[LiveActivity] Failed to start activity: \(error.localizedDescription)")
        }
    }

    @objc public func update(jsonString: String) {
        guard let data = jsonString.data(using: .utf8) else { return }
        
        struct UpdatePayload: Decodable {
            let handle: String
            let tweets_count: UInt64
            let media_count: UInt64
            let total_bytes: UInt64
            let speed_text: String
            let status_text: String
            let progress_pct: Double
            let is_locked: Bool
        }
        
        guard let payload = try? JSONDecoder().decode(UpdatePayload.self, from: data) else { return }
        
        let newState = FxTweetActivityAttributes.ContentState(
            tweetsCount: payload.tweets_count,
            mediaCount: payload.media_count,
            totalBytes: payload.total_bytes,
            speedText: payload.speed_text,
            statusText: payload.status_text,
            progressPct: payload.progress_pct,
            isLocked: payload.is_locked
        )
        
        Task {
            await currentActivity?.update(.init(state: newState, staleDate: nil))
        }
    }

    @objc public func end(summary: String) {
        Task {
            await currentActivity?.end(nil, dismissalPolicy: .after(Date().addingTimeInterval(5)))
            currentActivity = nil
        }
    }
}

// C-compatible FFI symbols exported for Rust
@_cdecl("fxtweet_start_live_activity")
public func fxtweet_start_live_activity(handlePtr: UnsafePointer<UInt8>?, handleLen: Int) {
    guard let ptr = handlePtr else { return }
    let data = Data(bytes: ptr, count: handleLen)
    guard let handle = String(data: data, encoding: .utf8) else { return }
    if #available(iOS 16.1, *) {
        LiveActivityManager.shared.start(handle: handle)
    }
}

@_cdecl("fxtweet_update_live_activity")
public func fxtweet_update_live_activity(jsonPtr: UnsafePointer<UInt8>?, jsonLen: Int) {
    guard let ptr = jsonPtr else { return }
    let data = Data(bytes: ptr, count: jsonLen)
    guard let json = String(data: data, encoding: .utf8) else { return }
    if #available(iOS 16.1, *) {
        LiveActivityManager.shared.update(jsonString: json)
    }
}

@_cdecl("fxtweet_end_live_activity")
public func fxtweet_end_live_activity(summaryPtr: UnsafePointer<UInt8>?, summaryLen: Int) {
    let summary: String
    if let ptr = summaryPtr {
        let data = Data(bytes: ptr, count: summaryLen)
        summary = String(data: data, encoding: .utf8) ?? "Finished"
    } else {
        summary = "Finished"
    }
    if #available(iOS 16.1, *) {
        LiveActivityManager.shared.end(summary: summary)
    }
}
