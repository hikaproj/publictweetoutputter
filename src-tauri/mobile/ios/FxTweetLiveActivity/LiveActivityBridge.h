//
//  LiveActivityBridge.h
//  FxTwitter Archive Studio - by Hikaproj
//

#ifndef LiveActivityBridge_h
#define LiveActivityBridge_h

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

void fxtweet_start_live_activity(const uint8_t *handle_ptr, size_t handle_len);
void fxtweet_update_live_activity(const uint8_t *json_ptr, size_t json_len);
void fxtweet_end_live_activity(const uint8_t *summary_ptr, size_t summary_len);

#ifdef __cplusplus
}
#endif

#endif /* LiveActivityBridge_h */
